// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {Arena} from "../src/Arena.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {Treasury} from "../src/Treasury.sol";
import {PromptLib} from "../src/lib/PromptLib.sol";
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

    // Re-declared locally so vm.expectEmit can match Arena's event by topic.
    event AgentForfeited(uint256 indexed matchId, uint256 agentId);

    uint256 hawk;
    uint256 diplo;
    uint256 quant;
    uint256 contra;

    // Worst-case operating funds the Arena requires up-front (mostly rebated): scales with
    // MAX_ROUNDS now. 4 agents × 10 rounds × 0.24 + lots × 0.12. We just over-fund in tests.
    uint256 constant OPERATING = 12 ether;

    function setUp() public {
        plat = new MockPlatform();
        reg = new AgentRegistry(address(this));
        treas = new Treasury(address(this), address(this));
        arena = new Arena(address(plat), address(reg), address(treas), address(this));
        reg.setOperator(address(arena), true);
        treas.setOperator(address(arena), true);

        hawk   = reg.mint(address(0xAA1), keccak256("hawk"), "ipfs://hawk", "Hawk");
        diplo  = reg.mint(address(0xAA2), keccak256("diplo"), "ipfs://diplo", "Diplomat");
        quant  = reg.mint(address(0xAA3), keccak256("quant"), "ipfs://quant", "Quant");
        contra = reg.mint(address(0xAA4), keccak256("contra"), "ipfs://contra", "Contrarian");

        vm.deal(address(this), 1000 ether);
    }

    // --- helpers --------------------------------------------------------------------------

    function _ids() internal view returns (uint256[] memory ids) {
        ids = new uint256[](4);
        ids[0] = hawk; ids[1] = diplo; ids[2] = quant; ids[3] = contra;
    }

    function _twoLots() internal pure returns (Arena.LotTemplate[] memory lots) {
        lots = new Arena.LotTemplate[](2);
        lots[0] = Arena.LotTemplate("ETH-USD", "https://api/eth", "data.amount", 0, 1, "~2000");
        lots[1] = Arena.LotTemplate("BTC-USD", "https://api/btc", "data.amount", 0, 1, "~80000");
    }

    function _oneLot() internal pure returns (Arena.LotTemplate[] memory lots) {
        lots = new Arena.LotTemplate[](1);
        lots[0] = Arena.LotTemplate("ETH-USD", "u", "s", 0, 1, "~2000");
    }

    function _openMatch() internal returns (uint256 matchId) {
        matchId = arena.openExhibition{value: OPERATING}(_ids(), 25, _twoLots());
    }

    function _phase(uint256 matchId) internal view returns (Arena.MatchPhase phase) {
        (, phase, , , , , , ) = arena.getMatch(matchId);
    }

    function _round(uint256 matchId) internal view returns (uint8 round) {
        (, , , , , round, , ) = arena.getMatch(matchId);
    }

    /// Deliver a move to the in-flight move request (the most recently created one).
    function _move(string memory s) internal {
        plat.deliverString(plat.nextRequestId() - 1, s);
    }

    /// Fail the in-flight move request.
    function _moveFail() internal {
        plat.deliverFail(plat.nextRequestId() - 1);
    }

    /// Pass on every remaining turn until the match leaves Negotiating. Because a full round with
    /// no successful bid ends the match (stall), this always terminates within ~2 rounds.
    function _drainPasses(uint256 matchId) internal {
        for (uint256 i = 0; i < 64; i++) {
            if (_phase(matchId) != Arena.MatchPhase.Negotiating) return;
            _move("PASS");
        }
        revert("drain did not settle");
    }

    // --- core lifecycle -------------------------------------------------------------------

    function testFullExhibitionRunsToSettlement() public {
        uint256 matchId = _openMatch();
        plat.deliverUint(1, 350000); // ETH-USD
        plat.deliverUint(2, 8800000); // BTC-USD

        assertEq(uint256(_phase(matchId)), uint256(Arena.MatchPhase.Negotiating));
        (, , , , uint8 maxRounds, , , ) = arena.getMatch(matchId);
        assertEq(maxRounds, arena.MAX_ROUNDS(), "rounds field now reports the cap");

        // Round 1: a bidding round on lot 1
        _move("OFFER|lot=1|side=BUY|price=10");  // Hawk
        _move("PASS");                            // Diplomat
        _move("COUNTER|lot=1|price=12");          // Quant
        _move("PASS");                            // Contrarian
        // Round 2: a bidding round on lot 2
        _move("OFFER|lot=2|side=BUY|price=15");   // Hawk
        _move("PASS");
        _move("PASS");
        _move("COUNTER|lot=2|price=16");          // Contrarian
        // Round 3: nobody improves → market stalls → settle
        _drainPasses(matchId);

        assertEq(uint256(_phase(matchId)), uint256(Arena.MatchPhase.Finalized));
        Arena.Lot memory l1 = arena.getLot(matchId, 0);
        Arena.Lot memory l2 = arena.getLot(matchId, 1);
        assertEq(l1.ownerAgentId, quant, "lot1 owner = quant (countered at 12)");
        assertEq(l1.paidPrice, 12);
        assertEq(l2.ownerAgentId, contra, "lot2 owner = contrarian (countered at 16)");
        assertEq(l2.paidPrice, 16);
        assertTrue(reg.getAgent(hawk).joinable);
        assertTrue(reg.getAgent(diplo).joinable);
    }

    /// A round with no successful bid ends the match early — well before the cap.
    function testStalledRoundEndsEarly() public {
        uint256 matchId = _openMatch();
        plat.deliverUint(1, 350000);
        plat.deliverUint(2, 8800000);

        // Round 1: only Hawk bids; everyone else passes (still progress → continue).
        _move("OFFER|lot=1|side=BUY|price=10");
        _move("PASS"); _move("PASS"); _move("PASS");
        // Round 2: nobody bids → stall → settle at round 2 (not the cap of 10).
        _drainPasses(matchId);

        assertEq(uint256(_phase(matchId)), uint256(Arena.MatchPhase.Finalized));
        assertEq(_round(matchId), 2, "ended on the stalled 2nd round, far short of MAX_ROUNDS");
        assertEq(arena.getLot(matchId, 0).ownerAgentId, hawk);
    }

    /// A continuous bidding war that never stalls is bounded by the MAX_ROUNDS cap. This also
    /// pushes the move log past LOG_WINDOW, exercising the ring buffer without breaking the machine.
    function testReachesCapOnContinuousBidding() public {
        uint256 matchId = arena.openExhibition{value: OPERATING}(_ids(), 100, _oneLot());
        plat.deliverUint(1, 50);

        // Round 1: open the bidding.
        _move("OFFER|lot=1|side=BUY|price=2");
        _move("PASS"); _move("PASS"); _move("PASS");
        // Rounds 2..10: Hawk raises by 1 every round → progress each round → never stalls.
        for (uint256 r = 2; r <= 10; r++) {
            if (_phase(matchId) != Arena.MatchPhase.Negotiating) break;
            _move(string.concat("COUNTER|lot=1|price=", vm.toString(r + 1)));
            _move("PASS"); _move("PASS"); _move("PASS");
        }

        assertEq(uint256(_phase(matchId)), uint256(Arena.MatchPhase.Finalized), "cap settled it");
        assertEq(_round(matchId), arena.MAX_ROUNDS(), "ran to the cap");
        assertEq(arena.getLot(matchId, 0).ownerAgentId, hawk, "hawk holds the lot at the cap");
        assertEq(arena.getLot(matchId, 0).paidPrice, 11);
    }

    /// Nothing ever traded → it's a no-contest draw: voided, agents freed, NO ELO change.
    function testNoTradeIsDrawNotAWin() public {
        uint256 matchId = _openMatch();
        plat.deliverUint(1, 50);
        plat.deliverUint(2, 60);

        // Round 1: everyone passes → no bid all round → stall with zero lots sold → draw.
        _drainPasses(matchId);

        assertEq(uint256(_phase(matchId)), uint256(Arena.MatchPhase.Voided), "no-trade -> voided draw");
        assertEq(arena.getLot(matchId, 0).ownerAgentId, 0);
        // No ELO churn, no match counted — it was a non-event.
        assertEq(reg.getAgent(hawk).elo, 1500, "ELO untouched on a draw");
        assertEq(reg.getAgent(hawk).matches, 0, "draw is not counted as a match");
        assertTrue(reg.getAgent(hawk).joinable);
        assertTrue(reg.getAgent(contra).joinable);
    }

    function testForfeitAfterThreeConsecutiveDefaults() public {
        uint256 matchId = _openMatch();
        plat.deliverUint(1, 100);
        plat.deliverUint(2, 200);

        // Keep the match alive with a real bid each round (Diplomat), while Hawk fails repeatedly.
        // Round 1
        _moveFail();                               // Hawk fail #1
        _move("OFFER|lot=1|side=BUY|price=5");      // Diplomat (progress)
        _move("PASS"); _move("PASS");
        // Round 2
        _moveFail();                               // Hawk fail #2
        _move("COUNTER|lot=1|price=6");             // Diplomat (progress)
        _move("PASS"); _move("PASS");
        // Round 3 — Hawk's 3rd consecutive default trips the forfeit.
        vm.expectEmit(true, false, false, true);
        emit AgentForfeited(matchId, hawk);
        _moveFail();                               // Hawk fail #3 → forfeit
        _drainPasses(matchId);

        assertEq(uint256(_phase(matchId)), uint256(Arena.MatchPhase.Finalized));
        // Diplomat traded, so the match is a real result (not a draw); Hawk took the forfeit hit.
        assertEq(arena.getLot(matchId, 0).ownerAgentId, diplo);
        assertEq(reg.getAgent(hawk).matches, 1, "match counted");
    }

    /// An illegal (over-budget) move is rejected and never buys; a legit bid still settles the match.
    function testIllegalMoveIsRejected() public {
        uint256 matchId = _openMatch();
        plat.deliverUint(1, 100);
        plat.deliverUint(2, 200);

        _move("OFFER|lot=1|side=BUY|price=999"); // Hawk: over budget (25) → rejected
        _move("OFFER|lot=1|side=BUY|price=10");  // Diplomat: legit buy (progress)
        _move("PASS"); _move("PASS");
        _drainPasses(matchId);

        assertEq(uint256(_phase(matchId)), uint256(Arena.MatchPhase.Finalized));
        // Hawk's bid didn't take the lot; Diplomat's did.
        assertEq(arena.getLot(matchId, 0).ownerAgentId, diplo);
        assertEq(arena.getLot(matchId, 0).paidPrice, 10);
        assertEq(reg.getAgent(hawk).matches, 1);
    }

    function testTiedOfferIsRejected() public {
        uint256 matchId = _openMatch();
        plat.deliverUint(1, 100);
        plat.deliverUint(2, 200);

        _move("OFFER|lot=1|side=BUY|price=10"); // Hawk takes lot 1 at 10
        _move("OFFER|lot=1|side=BUY|price=10"); // Diplo ties → rejected (no silent no-op)
        _move("PASS"); _move("PASS");
        _drainPasses(matchId);

        Arena.Lot memory l1 = arena.getLot(matchId, 0);
        assertEq(l1.ownerAgentId, hawk, "hawk's standing offer survives the tie");
        assertEq(l1.paidPrice, 10);
        assertEq(reg.getAgent(diplo).matches, 1);
    }

    function testRealStakesEndToEndPaysOutRanked() public {
        Arena.LotTemplate[] memory lots = _oneLot();
        vm.deal(address(this), 1000 ether);
        // pot = 25 × 4 = 100 ether, + operating budget on top.
        uint256 matchId = arena.openRealStakes{value: 100 ether + OPERATING}(_ids(), 25 ether, lots);

        vm.deal(address(0xAA1), 0);
        vm.deal(address(0xAA2), 0);
        vm.deal(address(0xAA3), 0);
        vm.deal(address(0xAA4), 0);

        plat.deliverUint(1, 50); // lot worth 50

        // Hawk buys at 30 (profit +20); others pass; then the market stalls → settle.
        _move("OFFER|lot=1|side=BUY|price=30");
        _drainPasses(matchId);

        assertEq(uint256(_phase(matchId)), uint256(Arena.MatchPhase.Finalized));
        // Rank: hawk (1, profit +20), then diplo/quant/contra tied at 0 → by index.
        assertEq(address(0xAA1).balance, 95 ether * 50 / 100, "hawk owner gets 47.5");
        assertEq(address(0xAA2).balance, 95 ether * 28 / 100, "diplomat owner gets 26.6");
        assertEq(address(0xAA3).balance, 95 ether * 15 / 100, "quant owner gets 14.25");
        assertEq(address(0xAA4).balance, 95 ether *  7 / 100, "contrarian owner gets 6.65");
        assertEq(treas.seasonFund(), 5 ether, "5% rake in season fund");
    }

    /// A real-stakes match that never trades is a draw → pot refunded to owners, no ELO change.
    function testRealStakesNoTradeRefunds() public {
        Arena.LotTemplate[] memory lots = _oneLot();
        vm.deal(address(this), 1000 ether);
        uint256 matchId = arena.openRealStakes{value: 100 ether + OPERATING}(_ids(), 25 ether, lots);

        vm.deal(address(0xAA1), 0);
        plat.deliverUint(1, 50);
        _drainPasses(matchId); // all pass → no trade → draw

        assertEq(uint256(_phase(matchId)), uint256(Arena.MatchPhase.Voided), "draw");
        assertEq(address(0xAA1).balance, 25 ether, "hawk owner refunded its stake");
        assertEq(reg.getAgent(hawk).elo, 1500, "no ELO change on a draw");
        assertEq(treas.seasonFund(), 0, "no rake taken on a draw");
    }

    function testPricingFailureVoidsMatch() public {
        uint256 matchId = _openMatch();
        plat.deliverFail(1);
        assertEq(uint256(_phase(matchId)), uint256(Arena.MatchPhase.Voided));
        assertTrue(reg.getAgent(hawk).joinable);
    }

    // --- Liveness / stall recovery --------------------------------------------------------

    function testReapStalledNegotiationSettlesOnHoldings() public {
        uint256 matchId = _openMatch();
        plat.deliverUint(1, 350000);
        plat.deliverUint(2, 8800000);
        _move("OFFER|lot=1|side=BUY|price=10"); // Hawk takes lot 1; next callback dropped

        uint256 dl = arena.reapableAt(matchId);
        vm.expectRevert(abi.encodeWithSelector(Arena.NotStalled.selector, matchId, dl));
        arena.reapStalled(matchId);

        vm.warp(block.timestamp + arena.turnTimeout() + 1);
        arena.reapStalled(matchId);

        assertEq(uint256(_phase(matchId)), uint256(Arena.MatchPhase.Finalized), "settled on holdings");
        Arena.Lot memory l1 = arena.getLot(matchId, 0);
        assertEq(l1.ownerAgentId, hawk, "hawk keeps the lot he won pre-stall");
        assertEq(l1.paidPrice, 10);
        assertTrue(reg.getAgent(hawk).joinable);
        assertTrue(reg.getAgent(contra).joinable);
    }

    function testReapStalledPricingVoids() public {
        uint256 matchId = _openMatch();
        vm.warp(block.timestamp + arena.turnTimeout() + 1);
        arena.reapStalled(matchId);
        assertEq(uint256(_phase(matchId)), uint256(Arena.MatchPhase.Voided));
        assertTrue(reg.getAgent(hawk).joinable);
        assertTrue(reg.getAgent(contra).joinable);
    }

    function testStaleCallbackAfterReapIsNoop() public {
        uint256 matchId = _openMatch();
        plat.deliverUint(1, 350000);
        plat.deliverUint(2, 8800000);
        uint256 inflight = plat.nextRequestId() - 1; // Diplomat's move, about to be orphaned
        _move("OFFER|lot=1|side=BUY|price=10");        // Hawk buys (this consumes its own req)
        // The next move req (Diplomat) is now in-flight; capture and drop it.
        inflight = plat.nextRequestId() - 1;
        vm.warp(block.timestamp + arena.turnTimeout() + 1);
        arena.reapStalled(matchId);

        plat.deliverString(inflight, "OFFER|lot=2|side=BUY|price=99"); // late, must do nothing
        assertEq(uint256(_phase(matchId)), uint256(Arena.MatchPhase.Finalized));
        assertEq(arena.getLot(matchId, 1).ownerAgentId, 0, "stale move did not buy lot 2");
    }

    function testReapOnFinalizedReverts() public {
        uint256 matchId = _openMatch();
        plat.deliverUint(1, 100);
        plat.deliverUint(2, 200);
        // One real trade so the match Finalizes (not a draw), then stalls to settle.
        _move("OFFER|lot=1|side=BUY|price=10");
        _drainPasses(matchId);
        assertEq(uint256(_phase(matchId)), uint256(Arena.MatchPhase.Finalized));
        assertEq(arena.reapableAt(matchId), 0, "finalized = not reapable");
        vm.expectRevert(abi.encodeWithSelector(Arena.NotStalled.selector, matchId, uint256(0)));
        arena.reapStalled(matchId);
    }

    function testUnaffordableMatchReverts() public {
        // Worst case for 4 agents × MAX_ROUNDS(10) + 2 lots = 40×0.24 + 2×0.12 = 9.84 ether.
        uint256 need = 40 * 0.24 ether + 2 * 0.12 ether;
        vm.expectRevert(abi.encodeWithSelector(Arena.UnaffordableMatch.selector, uint256(1 ether), need));
        arena.openExhibition{value: 1 ether}(_ids(), 25, _twoLots());
    }

    // --- PromptLib (pure render) ----------------------------------------------------------

    function testPromptLibRendersBudgetsAndCap() public {
        uint256[] memory ids = new uint256[](2);
        ids[0] = 1; ids[1] = 2;
        uint256[] memory budgets = new uint256[](2);
        budgets[0] = 25; budgets[1] = 30;
        PromptLib.Lot[] memory lots = new PromptLib.Lot[](1);
        lots[0] = PromptLib.Lot("ETH-USD", 1, "~2000", 0, 0, 0, 0);
        string[] memory log = new string[](1);
        log[0] = "R1.T0 a1 OFFER|lot=1|price=10";

        (string[] memory roles, string[] memory messages) =
            PromptLib.build("Hawk", "ipfs://x", 7, 3, 10, 1, ids, budgets, lots, log);

        assertEq(roles.length, 2);
        assertEq(roles[0], "system");
        // The state message should carry the round/cap, all budgets, and the log line.
        assertTrue(_contains(messages[1], "Round 3/10 (max)"), "shows round / cap");
        assertTrue(_contains(messages[1], "Budgets: agent1=25 agent2=30"), "shows all budgets");
        assertTrue(_contains(messages[1], "R1.T0 a1 OFFER"), "shows the log window");
    }

    function _contains(string memory hay, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(hay);
        bytes memory n = bytes(needle);
        if (n.length == 0 || n.length > h.length) return n.length == 0;
        for (uint256 i = 0; i <= h.length - n.length; i++) {
            bool m = true;
            for (uint256 j = 0; j < n.length; j++) {
                if (h[i + j] != n[j]) { m = false; break; }
            }
            if (m) return true;
        }
        return false;
    }
}
