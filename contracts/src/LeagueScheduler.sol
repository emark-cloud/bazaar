// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SomniaEventHandler} from "@somnia-chain/reactivity-contracts/contracts/SomniaEventHandler.sol";
import {SomniaExtensions} from "@somnia-chain/reactivity-contracts/contracts/interfaces/SomniaExtensions.sol";
import {AgentRegistry} from "./AgentRegistry.sol";
import {Arena} from "./Arena.sol";

/// @title LeagueScheduler — autonomous next-match opener
/// @notice Subscribes to `Arena.MatchFinalized` via Somnia on-chain reactivity. On every event,
/// the precompile fires `_onEvent` here, which (a) picks the top-ranked joinable agents from
/// `AgentRegistry`, (b) forwards a pre-funded pot + operating budget into `Arena.openRealStakes`.
/// This is the only piece of Bazaar that doesn't need a human or off-chain driver to start the next match.
///
/// Subscription ownership is THIS contract. The reactivity precompile requires the owner to hold
/// ≥32 STT continuously (it pays per-callback gas from this balance). The contract also reserves
/// extra STT for match operating funds, stake escrow, and audit-council top-ups. Funds are added
/// via plain transfers; `SchedulerStalled` fires when balance falls below the configured threshold.
///
/// SECURITY: `_onEvent` is gated by `SomniaEventHandler.onEvent`, which requires `msg.sender ==
/// 0x0100` (the reactivity precompile). The subscription filter pins origin/emitter to the
/// configured Arena address, so no other contract's events can drive the scheduler.
contract LeagueScheduler is SomniaEventHandler, Ownable {
    AgentRegistry public immutable registry;
    Arena         public immutable arena;

    // --- Tunables ---
    uint256 public entryStake          = 0.25 ether;   // per-agent stake (small so a modestly-funded
                                                       // scheduler can run real-stakes matches on testnet)
    uint8   public seatCount           = 4;            // agents per match
    uint8   public rounds              = 2;            // DEPRECATED: Arena now caps at Arena.MAX_ROUNDS; unused
    uint256 public operatingPerMatch   = 21 ether;     // sent alongside the pot to fund Arena's platform calls.
                                                       // Must cover Arena's worst case at MAX_ROUNDS=20 (~19.44 STT for
                                                       // 4 agents / 2 lots; 21 leaves margin for up to 8 lots ~20.16).
    uint256 public minBalanceThreshold = 45 ether;     // open-gate floor. Real gate is max(this, pot + operating
                                                       // + 32 STT reactivity reserve); ~54 STT at the defaults above.
    uint256 public matchLookbackBufferBlocks = 12;     // ignored — kept for backward-compat tuning
    /// @notice The MatchFinalized event signature topic Arena emits. Updated if the event sig changes.
    bytes32 public matchFinalizedTopic;

    // --- State ---
    uint256 public subscriptionId;
    uint256 public matchesScheduled;
    uint256 public callbacksReceived;

    /// @notice The latest two lot templates the scheduler uses to seat a match. Owner-settable so the
    /// economic story can evolve without redeploying the scheduler.
    Arena.LotTemplate[] internal _lotTemplates;

    // --- Events ---
    event SubscriptionEstablished(uint256 subscriptionId);
    event SubscriptionStopped(uint256 subscriptionId);
    event MatchScheduled(uint256 indexed matchId, uint256[] agentIds);
    event SchedulerStalled(uint256 balance, uint256 required);
    event LotTemplatesUpdated(uint8 count);
    event ConfigUpdated();

    // --- Errors ---
    error NoSubscription();
    error NotEnoughAgents(uint256 found);
    error NoLotTemplates();

    constructor(address registry_, address arena_, bytes32 matchFinalizedTopic_, address initialOwner)
        Ownable(initialOwner)
    {
        registry = AgentRegistry(registry_);
        arena    = Arena(payable(arena_));
        matchFinalizedTopic = matchFinalizedTopic_;
    }

    // --- Admin --------------------------------------------------------------

    function setSeatCount(uint8 c)             external onlyOwner { seatCount = c; emit ConfigUpdated(); }
    function setRounds(uint8 r)                external onlyOwner { rounds = r; emit ConfigUpdated(); }
    function setEntryStake(uint256 s)          external onlyOwner { entryStake = s; emit ConfigUpdated(); }
    function setOperatingPerMatch(uint256 o)   external onlyOwner { operatingPerMatch = o; emit ConfigUpdated(); }
    function setMinBalanceThreshold(uint256 t) external onlyOwner { minBalanceThreshold = t; emit ConfigUpdated(); }
    function setMatchFinalizedTopic(bytes32 t) external onlyOwner { matchFinalizedTopic = t; emit ConfigUpdated(); }

    /// @notice Replaces the in-storage lot templates. Send any number 1..8.
    function setLotTemplates(Arena.LotTemplate[] calldata templates) external onlyOwner {
        require(templates.length >= 1 && templates.length <= 8, "1..8 lots");
        delete _lotTemplates;
        for (uint256 i = 0; i < templates.length; i++) {
            _lotTemplates.push(templates[i]);
        }
        emit LotTemplatesUpdated(uint8(templates.length));
    }

    function getLotTemplates() external view returns (Arena.LotTemplate[] memory) {
        return _lotTemplates;
    }

    /// @notice Withdraw operating funds. Only the owner; only when no active subscription
    /// (otherwise we'd risk dropping the 32-STT balance gate mid-season).
    function withdraw(address to, uint256 amount) external onlyOwner {
        require(subscriptionId == 0, "subscribed");
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "withdraw failed");
    }

    // --- Subscription lifecycle ---------------------------------------------

    /// @notice Subscribes to `Arena.MatchFinalized`. Requires this contract to hold ≥32 STT.
    function start() external onlyOwner returns (uint256 subId) {
        require(subscriptionId == 0, "already active");
        require(_lotTemplates.length > 0, "no lots set");

        SomniaExtensions.SubscriptionFilter memory filter = SomniaExtensions.SubscriptionFilter({
            eventTopics: [
                matchFinalizedTopic,
                bytes32(0),
                bytes32(0),
                bytes32(0)
            ],
            origin: address(0),
            emitter: address(arena)
        });
        SomniaExtensions.SubscriptionOptions memory opts = SomniaExtensions.SubscriptionOptions({
            priorityFeePerGas: 0,
            maxFeePerGas:      20 gwei,
            gasLimit:          5_000_000          // enough for openRealStakes + a few JSON API requests in the same tx
        });
        subId = SomniaExtensions.subscribe(address(this), filter, opts);
        subscriptionId = subId;
        emit SubscriptionEstablished(subId);
    }

    function stop() external onlyOwner {
        if (subscriptionId == 0) revert NoSubscription();
        SomniaExtensions.unsubscribe(subscriptionId);
        emit SubscriptionStopped(subscriptionId);
        subscriptionId = 0;
    }

    // --- Reactive callback --------------------------------------------------

    function _onEvent(
        address /*emitter*/,
        bytes32[] calldata /*eventTopics*/,
        bytes calldata /*data*/
    ) internal override {
        callbacksReceived += 1;
        _maybeSchedule();
    }

    /// @dev Open the next match if we have enough joinable agents and balance.
    /// Idempotent within a single block: a second event won't open a duplicate match because
    /// agents are flipped to joinable=false inside `Arena.openRealStakes`.
    function _maybeSchedule() internal {
        uint256 lotCount = _lotTemplates.length;
        if (lotCount == 0) revert NoLotTemplates();

        uint256 cost = entryStake * seatCount + operatingPerMatch;
        if (address(this).balance < minBalanceThreshold || address(this).balance < cost + 32 ether) {
            emit SchedulerStalled(address(this).balance, cost + 32 ether);
            return;
        }

        uint256[] memory seats = _topJoinable(seatCount);
        if (seats.length < seatCount) {
            emit SchedulerStalled(address(this).balance, cost + 32 ether);
            return;
        }

        Arena.LotTemplate[] memory lots = new Arena.LotTemplate[](lotCount);
        for (uint256 i = 0; i < lotCount; i++) lots[i] = _lotTemplates[i];

        // `rounds` is no longer passed — the Arena caps every match at Arena.MAX_ROUNDS and ends
        // most earlier on a market stall. Operating funds must cover that worst case (operatingPerMatch).
        uint256 matchId = arena.openRealStakes{value: cost}(seats, entryStake, lots);
        matchesScheduled += 1;
        emit MatchScheduled(matchId, seats);
    }

    /// @dev Pick the top-K joinable agents from the registry by ELO, scanning a bounded window.
    /// Returns fewer than K if there aren't enough — caller handles short-pool case.
    function _topJoinable(uint256 k) internal view returns (uint256[] memory picks) {
        uint256 total = registry.totalAgents();
        if (total == 0) return new uint256[](0);
        // Scan up to first 64 agent IDs — enough for the demo, bounded gas.
        uint256 cap = total > 64 ? 64 : total;

        uint256[] memory ids   = new uint256[](cap);
        uint16[]  memory elos  = new uint16[](cap);
        uint256 n;
        for (uint256 id = 1; id <= cap; id++) {
            try registry.getAgent(id) returns (AgentRegistry.Agent memory a) {
                if (a.joinable) {
                    ids[n] = id;
                    elos[n] = a.elo;
                    n++;
                }
            } catch { /* skip un-minted */ }
        }
        if (n < k) {
            picks = new uint256[](n);
            for (uint256 i = 0; i < n; i++) picks[i] = ids[i];
            return picks;
        }
        // Selection sort top-K by ELO desc.
        picks = new uint256[](k);
        for (uint256 i = 0; i < k; i++) {
            uint256 best = i;
            for (uint256 j = i + 1; j < n; j++) {
                if (elos[j] > elos[best]) best = j;
            }
            (ids[i], ids[best]) = (ids[best], ids[i]);
            (elos[i], elos[best]) = (elos[best], elos[i]);
            picks[i] = ids[i];
        }
    }

    // --- Manual trigger for tests / fallback when reactivity is stalled -----

    /// @notice Anyone can poke the scheduler to open the next match if conditions are met. Useful when
    /// reactivity is being debugged or as a manual-cron fallback; same checks as the reactive path.
    function pokeOpenNext() external {
        _maybeSchedule();
    }

    receive() external payable {}
}
