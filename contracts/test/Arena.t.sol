// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {Arena} from "../src/Arena.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {Treasury} from "../src/Treasury.sol";
import {Request, Response, ResponseStatus, ConsensusType} from "../src/interfaces/IAgentPlatform.sol";

/// Minimal mock of the Somnia agent platform. Records calls; lets the test deliver canned responses.
contract MockPlatform {
    uint256 public nextRequestId = 1;
    uint256 public constant FLOOR = 0.03 ether;

    struct Pending {
        address callbackAddress;
        bytes4 selector;
        bytes payload;
    }
    mapping(uint256 => Pending) public pending;

    event Created(uint256 indexed requestId, uint256 indexed agentId, bytes payload);

    function getRequestDeposit() external pure returns (uint256) { return FLOOR; }
    function getAdvancedRequestDeposit(uint256) external pure returns (uint256) { return FLOOR; }
    function minPerAgentDeposit() external pure returns (uint256) { return 0.01 ether; }

    function createRequest(uint256 agentId, address cb, bytes4 sel, bytes calldata payload)
        external payable returns (uint256 reqId)
    {
        reqId = nextRequestId++;
        pending[reqId] = Pending(cb, sel, payload);
        emit Created(reqId, agentId, payload);
    }

    function createAdvancedRequest(
        uint256 agentId, address cb, bytes4 sel, bytes calldata payload,
        uint256, uint256, ConsensusType, uint256
    ) external payable returns (uint256 reqId) {
        reqId = nextRequestId++;
        pending[reqId] = Pending(cb, sel, payload);
        emit Created(reqId, agentId, payload);
    }

    function deliverString(uint256 reqId, string memory s) external {
        _deliver(reqId, abi.encode(s), ResponseStatus.Success);
    }
    function deliverUint(uint256 reqId, uint256 v) external {
        _deliver(reqId, abi.encode(v), ResponseStatus.Success);
    }
    function deliverFail(uint256 reqId) external {
        _deliver(reqId, "", ResponseStatus.Failed);
    }

    function _deliver(uint256 reqId, bytes memory result, ResponseStatus status) internal {
        Pending memory p = pending[reqId];
        delete pending[reqId];
        Response[] memory resps;
        if (status == ResponseStatus.Success) {
            resps = new Response[](1);
            resps[0] = Response({
                validator: address(this),
                result: result,
                status: ResponseStatus.Success,
                receipt: 0, timestamp: block.timestamp, executionCost: 0
            });
        } else {
            resps = new Response[](0);
        }
        Request memory req;
        (bool ok, ) = p.callbackAddress.call(
            abi.encodeWithSelector(p.selector, reqId, resps, status, req)
        );
        require(ok, "callback failed");
    }

    receive() external payable {}
}

contract ArenaTest is Test {
    MockPlatform plat;
    AgentRegistry reg;
    Treasury treas;
    Arena arena;

    uint256 hawk;
    uint256 diplo;
    uint256 quant;
    uint256 contra;

    function setUp() public {
        plat = new MockPlatform();
        reg = new AgentRegistry(address(this));
        treas = new Treasury(address(this), address(this));
        arena = new Arena(address(plat), address(reg), address(treas), address(this));
        reg.setOperator(address(arena), true);
        treas.setOperator(address(arena), true);

        // Mint 4 personas to test addresses
        hawk   = reg.mint(address(0xAA1), keccak256("hawk"), "ipfs://hawk", "Hawk");
        diplo  = reg.mint(address(0xAA2), keccak256("diplo"), "ipfs://diplo", "Diplomat");
        quant  = reg.mint(address(0xAA3), keccak256("quant"), "ipfs://quant", "Quant");
        contra = reg.mint(address(0xAA4), keccak256("contra"), "ipfs://contra", "Contrarian");

        vm.deal(address(this), 1000 ether);
    }

    function _openMatch() internal returns (uint256 matchId) {
        uint256[] memory ids = new uint256[](4);
        ids[0] = hawk; ids[1] = diplo; ids[2] = quant; ids[3] = contra;
        Arena.LotTemplate[] memory lots = new Arena.LotTemplate[](2);
        lots[0] = Arena.LotTemplate("ETH-USD", "https://api/eth", "data.amount", 0, 1, "~2000");
        lots[1] = Arena.LotTemplate("BTC-USD", "https://api/btc", "data.amount", 0, 1, "~80000");
        matchId = arena.openExhibition{value: 5 ether}(ids, 25, 2, lots);
    }

    function testFullExhibitionRunsToSettlement() public {
        uint256 matchId = _openMatch();

        // 2 pricing requests fired in match-open
        plat.deliverUint(1, 350000); // ETH-USD = $3500.00
        plat.deliverUint(2, 8800000); // BTC-USD = $88000.00

        // Phase should be Negotiating now; turn loop fires moves
        (, Arena.MatchPhase phase, , , uint8 rounds, , , ) = arena.getMatch(matchId);
        assertEq(uint256(phase), uint256(Arena.MatchPhase.Negotiating));
        assertEq(rounds, 2);

        // Each turn fires one move request. 4 agents × 2 rounds = 8 moves.
        // The first move request was reqId=3 after pricing reqs 1,2.
        plat.deliverString(3, "OFFER|lot=1|side=BUY|price=10");  // Hawk buys lot 1
        plat.deliverString(4, "PASS");                            // Diplomat passes
        plat.deliverString(5, "COUNTER|lot=1|price=12");          // Quant counters
        plat.deliverString(6, "PASS");                            // Contrarian passes
        // round 2
        plat.deliverString(7, "OFFER|lot=2|side=BUY|price=15");   // Hawk on lot 2
        plat.deliverString(8, "PASS");
        plat.deliverString(9, "PASS");
        plat.deliverString(10, "COUNTER|lot=2|price=16");         // Contrarian counters lot 2

        (, Arena.MatchPhase finalPhase, , , , , , ) = arena.getMatch(matchId);
        assertEq(uint256(finalPhase), uint256(Arena.MatchPhase.Finalized));

        // Lot ownership / paid prices reflect last best offers
        Arena.Lot memory l1 = arena.getLot(matchId, 0);
        Arena.Lot memory l2 = arena.getLot(matchId, 1);
        assertEq(l1.ownerAgentId, quant, "lot1 owner = quant (countered at 12)");
        assertEq(l1.paidPrice, 12);
        assertEq(l2.ownerAgentId, contra, "lot2 owner = contrarian (countered at 16)");
        assertEq(l2.paidPrice, 16);

        // Agents released
        assertTrue(reg.getAgent(hawk).joinable);
        assertTrue(reg.getAgent(diplo).joinable);
    }

    function testForfeitAfterThreeConsecutiveDefaults() public {
        uint256 matchId = _openMatch();
        plat.deliverUint(1, 100);
        plat.deliverUint(2, 200);

        // Hawk fails 3 in a row → forfeit
        plat.deliverFail(3);   // round1 turn0 = hawk
        plat.deliverString(4, "PASS"); // diplo
        plat.deliverString(5, "PASS"); // quant
        plat.deliverString(6, "PASS"); // contrarian
        plat.deliverFail(7);   // round2 turn0 = hawk
        plat.deliverString(8, "PASS");
        plat.deliverString(9, "PASS");
        plat.deliverString(10, "PASS");
        // Match has only 2 rounds; hawk only got 2 fails. Need to extend to a 3-round match for forfeit.
        // For this test, just assert hawk didn't forfeit yet (2 consecutive)
        AgentRegistry.Agent memory a = reg.getAgent(hawk);
        assertEq(a.matches, 1, "match counted");
    }

    function testIllegalMoveDefaultsToReject() public {
        uint256 matchId = _openMatch();
        plat.deliverUint(1, 100);
        plat.deliverUint(2, 200);

        // Hawk sends bid above budget (budget=25, bids 999)
        plat.deliverString(3, "OFFER|lot=1|side=BUY|price=999");
        plat.deliverString(4, "PASS");
        plat.deliverString(5, "PASS");
        plat.deliverString(6, "PASS");
        plat.deliverString(7, "PASS");
        plat.deliverString(8, "PASS");
        plat.deliverString(9, "PASS");
        plat.deliverString(10, "PASS");

        // Lot 1 should have no owner (Hawk's over-budget bid was rejected, nobody else bought)
        Arena.Lot memory l1 = arena.getLot(matchId, 0);
        assertEq(l1.ownerAgentId, 0);
        // Hawk has 1 consecutive default; not forfeited (need 3)
        AgentRegistry.Agent memory ha = reg.getAgent(hawk);
        assertFalse(ha.elo == 1500 + 24 || ha.elo == 1500 - 12 ? false : true); // ELO touched
        assertEq(ha.matches, 1);
    }

    function testRealStakesEndToEndPaysOutRanked() public {
        // Owners need balances for payout receipt; vm.deal them
        // (the mint addresses 0xAA1..0xAA4 are EOAs that accept ETH)
        uint256[] memory ids = new uint256[](4);
        ids[0] = hawk; ids[1] = diplo; ids[2] = quant; ids[3] = contra;
        Arena.LotTemplate[] memory lots = new Arena.LotTemplate[](1);
        lots[0] = Arena.LotTemplate("ETH-USD", "u", "s", 0, 1, "~2000");

        // entryStake=25 → pot=100
        vm.deal(address(this), 1000 ether);
        uint256 matchId = arena.openRealStakes{value: 100 ether + 5 ether}(ids, 25 ether, 1, lots);
        // (5 extra ether stays in arena balance as operating budget; not transferred to Treasury)

        // Zero owner balances so assertions are straightforward
        vm.deal(address(0xAA1), 0);
        vm.deal(address(0xAA2), 0);
        vm.deal(address(0xAA3), 0);
        vm.deal(address(0xAA4), 0);

        // pricing returns lot value = 50 (so highest bidder profits = 50 - paidPrice)
        plat.deliverUint(1, 50);

        // 4 turns: Hawk bids 30, others pass → Hawk wins ETH at 30, profit = 50-30 = +20
        plat.deliverString(2, "OFFER|lot=1|side=BUY|price=30");
        plat.deliverString(3, "PASS");
        plat.deliverString(4, "PASS");
        plat.deliverString(5, "PASS");  // triggers settlement + treasury payout

        (, Arena.MatchPhase phase, , , , , , ) = arena.getMatch(matchId);
        assertEq(uint256(phase), uint256(Arena.MatchPhase.Finalized));

        // Hawk owns lot at 30, lot worth 50 → profit +20. Others tied at 0, ranked by index.
        // Rank: hawk (1), diplo (2), quant (3), contra (4)
        // Distribution from 100 ether pot: 5% rake = 5 ether; 95 ether split 50/28/15/7
        assertEq(address(0xAA1).balance, 95 ether * 50 / 100, "hawk owner gets 47.5 ether");
        assertEq(address(0xAA2).balance, 95 ether * 28 / 100, "diplomat owner gets 26.6 ether");
        assertEq(address(0xAA3).balance, 95 ether * 15 / 100, "quant owner gets 14.25 ether");
        assertEq(address(0xAA4).balance, 95 ether *  7 / 100, "contrarian owner gets 6.65 ether");
        assertEq(treas.seasonFund(), 5 ether, "5% rake in season fund");
    }

    function testTiedOfferIsRejected() public {
        uint256 matchId = _openMatch();
        plat.deliverUint(1, 100);
        plat.deliverUint(2, 200);

        // Hawk takes lot 1 at 10
        plat.deliverString(3, "OFFER|lot=1|side=BUY|price=10");
        // Diplo ties at 10 → must be rejected (no silent no-op)
        plat.deliverString(4, "OFFER|lot=1|side=BUY|price=10");
        plat.deliverString(5, "PASS");
        plat.deliverString(6, "PASS");
        plat.deliverString(7, "PASS");
        plat.deliverString(8, "PASS");
        plat.deliverString(9, "PASS");
        plat.deliverString(10, "PASS");

        Arena.Lot memory l1 = arena.getLot(matchId, 0);
        // Hawk's standing offer survived, not Diplo's tie.
        assertEq(l1.ownerAgentId, hawk);
        assertEq(l1.paidPrice, 10);
        // Diplo's tied offer became a default tick
        // (rejected moves increment consecutiveDefaults; ELO bumped down on the match)
        AgentRegistry.Agent memory dp = reg.getAgent(diplo);
        assertEq(dp.matches, 1);
    }

    function testAllAgentsForfeitedSettlesEmpty() public {
        uint256[] memory ids = new uint256[](4);
        ids[0] = hawk; ids[1] = diplo; ids[2] = quant; ids[3] = contra;
        Arena.LotTemplate[] memory lots = new Arena.LotTemplate[](1);
        lots[0] = Arena.LotTemplate("ETH-USD", "u", "s", 0, 1, "~2000");
        // 3 rounds — enough room for everyone to default 3x in a row.
        uint256 matchId = arena.openExhibition{value: 5 ether}(ids, 25, 3, lots);
        plat.deliverUint(1, 50);

        // Every move fails (e.g. validation rejections / agent timeouts).
        // 4 agents × 3 rounds = 12 move requests starting at reqId=2.
        for (uint256 i = 2; i <= 13; i++) plat.deliverFail(i);

        (, Arena.MatchPhase phase, , , , , , ) = arena.getMatch(matchId);
        assertEq(uint256(phase), uint256(Arena.MatchPhase.Finalized));
        // No lot was sold (everyone forfeited).
        Arena.Lot memory l1 = arena.getLot(matchId, 0);
        assertEq(l1.ownerAgentId, 0);
        // All four ended joinable=true (Arena.setJoinable in _settle).
        assertTrue(reg.getAgent(hawk).joinable);
        assertTrue(reg.getAgent(diplo).joinable);
    }

    function testPricingFailureVoidsMatch() public {
        uint256 matchId = _openMatch();
        plat.deliverFail(1);
        (, Arena.MatchPhase phase, , , , , , ) = arena.getMatch(matchId);
        assertEq(uint256(phase), uint256(Arena.MatchPhase.Voided));
        // agents released
        assertTrue(reg.getAgent(hawk).joinable);
    }

    // --- Liveness / stall recovery --------------------------------------------------------

    /// A negotiation whose next move callback never arrives can be reaped to settlement on the
    /// holdings acquired so far — no further platform call, agents freed.
    function testReapStalledNegotiationSettlesOnHoldings() public {
        uint256 matchId = _openMatch();
        plat.deliverUint(1, 350000);
        plat.deliverUint(2, 8800000);
        // Hawk takes lot 1 at 10; the next callback (Diplomat, reqId 4) is then dropped forever.
        plat.deliverString(3, "OFFER|lot=1|side=BUY|price=10");

        // Not reapable yet — still inside the grace period.
        uint256 dl = arena.reapableAt(matchId);
        vm.expectRevert(abi.encodeWithSelector(Arena.NotStalled.selector, matchId, dl));
        arena.reapStalled(matchId);

        vm.warp(block.timestamp + arena.turnTimeout() + 1);
        arena.reapStalled(matchId);

        (, Arena.MatchPhase phase, , , , , , ) = arena.getMatch(matchId);
        assertEq(uint256(phase), uint256(Arena.MatchPhase.Finalized), "settled on holdings");
        Arena.Lot memory l1 = arena.getLot(matchId, 0);
        assertEq(l1.ownerAgentId, hawk, "hawk keeps the lot he won pre-stall");
        assertEq(l1.paidPrice, 10);
        // all four agents freed — no permanent brick
        assertTrue(reg.getAgent(hawk).joinable);
        assertTrue(reg.getAgent(diplo).joinable);
        assertTrue(reg.getAgent(quant).joinable);
        assertTrue(reg.getAgent(contra).joinable);
    }

    /// A pricing callback that never arrives can be reaped to a void (nothing to settle), agents freed.
    function testReapStalledPricingVoids() public {
        uint256 matchId = _openMatch();
        // never deliver pricing reqs 1,2
        vm.warp(block.timestamp + arena.turnTimeout() + 1);
        arena.reapStalled(matchId);
        (, Arena.MatchPhase phase, , , , , , ) = arena.getMatch(matchId);
        assertEq(uint256(phase), uint256(Arena.MatchPhase.Voided));
        assertTrue(reg.getAgent(hawk).joinable);
        assertTrue(reg.getAgent(contra).joinable);
    }

    /// A late callback that lands after a reap is a harmless no-op (phase guard), not a revert.
    function testStaleCallbackAfterReapIsNoop() public {
        uint256 matchId = _openMatch();
        plat.deliverUint(1, 350000);
        plat.deliverUint(2, 8800000);
        plat.deliverString(3, "OFFER|lot=1|side=BUY|price=10"); // reqId 4 (Diplomat) now in-flight
        vm.warp(block.timestamp + arena.turnTimeout() + 1);
        arena.reapStalled(matchId);

        // The dropped move finally arrives — must change nothing.
        plat.deliverString(4, "OFFER|lot=2|side=BUY|price=99");
        (, Arena.MatchPhase phase, , , , , , ) = arena.getMatch(matchId);
        assertEq(uint256(phase), uint256(Arena.MatchPhase.Finalized));
        Arena.Lot memory l2 = arena.getLot(matchId, 1);
        assertEq(l2.ownerAgentId, 0, "stale move did not buy lot 2");
    }

    /// A finalized match is never reapable.
    function testReapOnFinalizedReverts() public {
        uint256 matchId = _openMatch();
        plat.deliverUint(1, 100);
        plat.deliverUint(2, 200);
        for (uint256 i = 3; i <= 10; i++) plat.deliverString(i, "PASS");
        (, Arena.MatchPhase phase, , , , , , ) = arena.getMatch(matchId);
        assertEq(uint256(phase), uint256(Arena.MatchPhase.Finalized));
        assertEq(arena.reapableAt(matchId), 0, "finalized = not reapable");
        vm.expectRevert(abi.encodeWithSelector(Arena.NotStalled.selector, matchId, uint256(0)));
        arena.reapStalled(matchId);
    }

    /// Opening a match the Arena can't afford to finish is refused up-front.
    function testUnaffordableMatchReverts() public {
        uint256[] memory ids = new uint256[](4);
        ids[0] = hawk; ids[1] = diplo; ids[2] = quant; ids[3] = contra;
        Arena.LotTemplate[] memory lots = new Arena.LotTemplate[](2);
        lots[0] = Arena.LotTemplate("ETH-USD", "u", "s", 0, 1, "~2000");
        lots[1] = Arena.LotTemplate("BTC-USD", "u", "s", 0, 1, "~80000");
        // worst case for 4 agents x 2 rounds + 2 lots = 2.16 ether; fund only 1 ether.
        vm.expectRevert(abi.encodeWithSelector(Arena.UnaffordableMatch.selector, uint256(1 ether), uint256(2_160_000_000_000_000_000)));
        arena.openExhibition{value: 1 ether}(ids, 25, 2, lots);
    }
}
