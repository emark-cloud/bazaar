// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ITreasury} from "./interfaces/ITreasury.sol";

/// @title Treasury — escrow + rank-weighted payout + rake for Bazaar real-stakes matches
/// @notice One Treasury per deployment. Holds entry stakes during a match, distributes the pot
/// to ranked agent owners on settlement (minus protocol rake), and supports an AuditCouncil-
/// triggered freeze window.
///
/// Payout weights (rank-weighted, post-rake):
///   1 agent  : winner = 100%
///   2 agents : 70 / 30
///   3 agents : 55 / 30 / 15
///   4 agents : 50 / 28 / 15 / 7
///   5+       : winner-heavy decay (see `_weights`)
contract Treasury is ITreasury, Ownable, ReentrancyGuard {
    /// 5% protocol rake; basis points out of 10_000
    uint256 public constant RAKE_BPS = 500;
    uint256 public constant BPS_DENOM = 10_000;

    struct EscrowedMatch {
        uint256 entryStake;
        uint256 pot;                  // total STT held for this match
        uint256[] agentIds;
        address[] owners;             // parallel to agentIds (snapshot at escrow time)
        bool settled;
        bool refunded;
        uint256 frozenUntil;          // 0 = not frozen; else block.timestamp must exceed this to settle
    }

    mapping(uint256 => EscrowedMatch) internal _escrows;
    mapping(address => bool) public operators;

    /// @notice Accumulated protocol rake (drains to `seasonFundRecipient` on `drainSeasonFund`).
    uint256 public seasonFund;
    address public seasonFundRecipient;

    event MatchEscrowed(uint256 indexed matchId, uint256 pot, uint256 entryStake, uint256[] agentIds);
    event MatchSettled(uint256 indexed matchId, uint256 pot, uint256 rake, uint256[] rankedAgentIds, uint256[] payouts);
    event MatchRefunded(uint256 indexed matchId, uint256 pot);
    event MatchFrozen(uint256 indexed matchId, uint256 frozenUntil);
    event MatchUnfrozen(uint256 indexed matchId);
    event SeasonFundDrained(address indexed to, uint256 amount);
    event OperatorSet(address indexed operator, bool allowed);
    event PayoutSent(uint256 indexed matchId, uint256 indexed agentId, address indexed owner, uint256 amount);
    event PayoutFailed(uint256 indexed matchId, uint256 indexed agentId, address indexed owner, uint256 amount);

    error NotOperator(address sender);
    error BadStakeAmount(uint256 sent, uint256 expected);
    error MatchUnknown(uint256 matchId);
    error MatchAlreadySettled(uint256 matchId);
    error MatchAlreadyRefunded(uint256 matchId);
    error MatchFrozenActive(uint256 matchId, uint256 frozenUntil);
    error BadAgentList();

    modifier onlyOperator() {
        if (!operators[msg.sender]) revert NotOperator(msg.sender);
        _;
    }

    constructor(address initialOwner, address seasonFundRecipient_)
        Ownable(initialOwner)
    {
        seasonFundRecipient = seasonFundRecipient_;
    }

    // --- Admin ---------------------------------------------------------------------------

    function setOperator(address operator, bool allowed) external onlyOwner {
        operators[operator] = allowed;
        emit OperatorSet(operator, allowed);
    }

    function setSeasonFundRecipient(address recipient) external onlyOwner {
        seasonFundRecipient = recipient;
    }

    function drainSeasonFund() external onlyOwner nonReentrant {
        uint256 amt = seasonFund;
        seasonFund = 0;
        if (amt > 0) {
            (bool ok, ) = seasonFundRecipient.call{value: amt}("");
            require(ok, "drain failed");
            emit SeasonFundDrained(seasonFundRecipient, amt);
        }
    }

    // --- Arena hooks ----------------------------------------------------------------------

    function escrowMatch(
        uint256 matchId,
        uint256[] calldata agentIds,
        address[] calldata agentOwners,
        uint256 entryStake
    ) external payable onlyOperator {
        if (agentIds.length == 0 || agentIds.length != agentOwners.length) revert BadAgentList();
        uint256 expected = entryStake * agentIds.length;
        if (msg.value != expected) revert BadStakeAmount(msg.value, expected);
        EscrowedMatch storage e = _escrows[matchId];
        require(e.pot == 0, "already escrowed");

        e.entryStake = entryStake;
        e.pot = msg.value;
        for (uint256 i = 0; i < agentIds.length; i++) {
            e.agentIds.push(agentIds[i]);
            e.owners.push(agentOwners[i]);
        }
        emit MatchEscrowed(matchId, msg.value, entryStake, agentIds);
    }

    function settleMatch(uint256 matchId, uint256[] calldata rankedAgentIds)
        external onlyOperator nonReentrant
    {
        EscrowedMatch storage e = _escrows[matchId];
        if (e.pot == 0) revert MatchUnknown(matchId);
        if (e.settled) revert MatchAlreadySettled(matchId);
        if (e.refunded) revert MatchAlreadyRefunded(matchId);
        if (e.frozenUntil != 0 && block.timestamp < e.frozenUntil) {
            revert MatchFrozenActive(matchId, e.frozenUntil);
        }
        require(rankedAgentIds.length == e.agentIds.length, "rank len");

        uint256 pot = e.pot;
        uint256 rake = (pot * RAKE_BPS) / BPS_DENOM;
        uint256 distributable = pot - rake;

        uint256[] memory weights = _weights(rankedAgentIds.length);
        uint256[] memory payouts = new uint256[](rankedAgentIds.length);

        // Effects before interactions: zero the pot, increment season fund, record settled.
        e.pot = 0;
        e.settled = true;
        seasonFund += rake;

        // Compute payouts
        uint256 totalPaid;
        for (uint256 i = 0; i < rankedAgentIds.length; i++) {
            payouts[i] = (distributable * weights[i]) / 100;
            totalPaid += payouts[i];
        }
        // Dust → winner
        if (totalPaid < distributable) {
            payouts[0] += (distributable - totalPaid);
        }

        // Interactions: send payouts to original NFT owners; ranked-agentId → owner lookup
        for (uint256 i = 0; i < rankedAgentIds.length; i++) {
            address owner = _ownerOf(e, rankedAgentIds[i]);
            if (payouts[i] > 0) {
                (bool ok, ) = owner.call{value: payouts[i]}("");
                if (ok) emit PayoutSent(matchId, rankedAgentIds[i], owner, payouts[i]);
                else {
                    // Owner call failed: route to season fund so contract doesn't keep the funds stuck.
                    seasonFund += payouts[i];
                    emit PayoutFailed(matchId, rankedAgentIds[i], owner, payouts[i]);
                }
            }
        }

        emit MatchSettled(matchId, pot, rake, rankedAgentIds, payouts);
    }

    function refundMatch(uint256 matchId) external onlyOperator nonReentrant {
        EscrowedMatch storage e = _escrows[matchId];
        if (e.pot == 0) revert MatchUnknown(matchId);
        if (e.settled) revert MatchAlreadySettled(matchId);
        if (e.refunded) revert MatchAlreadyRefunded(matchId);

        uint256 pot = e.pot;
        e.pot = 0;
        e.refunded = true;

        uint256 each = pot / e.agentIds.length;
        // dust into season fund
        uint256 paid;
        for (uint256 i = 0; i < e.owners.length; i++) {
            (bool ok, ) = e.owners[i].call{value: each}("");
            if (ok) paid += each;
            else seasonFund += each;
        }
        if (paid < pot) seasonFund += (pot - paid);
        emit MatchRefunded(matchId, pot);
    }

    function freezeMatch(uint256 matchId, uint256 appealUntilTimestamp) external onlyOperator {
        EscrowedMatch storage e = _escrows[matchId];
        if (e.pot == 0 && !e.settled) revert MatchUnknown(matchId);
        e.frozenUntil = appealUntilTimestamp;
        emit MatchFrozen(matchId, appealUntilTimestamp);
    }

    function unfreezeMatch(uint256 matchId) external onlyOperator {
        _escrows[matchId].frozenUntil = 0;
        emit MatchUnfrozen(matchId);
    }

    // --- Views ----------------------------------------------------------------------------

    function getEscrow(uint256 matchId) external view returns (
        uint256 entryStake, uint256 pot, uint256[] memory agentIds, address[] memory owners,
        bool settled, bool refunded, uint256 frozenUntil
    ) {
        EscrowedMatch storage e = _escrows[matchId];
        return (e.entryStake, e.pot, e.agentIds, e.owners, e.settled, e.refunded, e.frozenUntil);
    }

    // --- Internals ------------------------------------------------------------------------

    function _ownerOf(EscrowedMatch storage e, uint256 agentId) internal view returns (address) {
        for (uint256 i = 0; i < e.agentIds.length; i++) {
            if (e.agentIds[i] == agentId) return e.owners[i];
        }
        revert BadAgentList();
    }

    /// @dev Rank-weighted distribution percentages (sum to 100). Winner-heavy.
    function _weights(uint256 n) internal pure returns (uint256[] memory w) {
        w = new uint256[](n);
        if (n == 1) { w[0] = 100; return w; }
        if (n == 2) { w[0] = 70; w[1] = 30; return w; }
        if (n == 3) { w[0] = 55; w[1] = 30; w[2] = 15; return w; }
        if (n == 4) { w[0] = 50; w[1] = 28; w[2] = 15; w[3] = 7; return w; }
        // n >= 5: 40 / 25 / 18 / 10 / 7 / then 0 for rest (dust → winner)
        w[0] = 40; w[1] = 25; w[2] = 18; w[3] = 10; w[4] = 7;
        // remaining = 0
    }

    receive() external payable {}
}
