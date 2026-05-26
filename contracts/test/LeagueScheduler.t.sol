// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test, Vm, console2} from "forge-std/Test.sol";
import {LeagueScheduler} from "../src/LeagueScheduler.sol";
import {Arena} from "../src/Arena.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {Treasury} from "../src/Treasury.sol";
import {Request, Response, ResponseStatus, ConsensusType} from "../src/interfaces/IAgentPlatform.sol";

/// Minimal mock platform — accepts createRequest, lets test deliver canned responses
contract MockPlatform3 {
    uint256 public nextRequestId = 1;
    struct Pending { address callbackAddress; bytes4 selector; bytes payload; }
    mapping(uint256 => Pending) public pending;

    function getRequestDeposit() external pure returns (uint256) { return 0.03 ether; }
    function getAdvancedRequestDeposit(uint256) external pure returns (uint256) { return 0.03 ether; }
    function minPerAgentDeposit() external pure returns (uint256) { return 0.01 ether; }

    function createRequest(uint256, address cb, bytes4 sel, bytes calldata payload)
        external payable returns (uint256 reqId)
    {
        reqId = nextRequestId++;
        pending[reqId] = Pending(cb, sel, payload);
    }
    function createAdvancedRequest(uint256, address cb, bytes4 sel, bytes calldata payload,
        uint256, uint256, ConsensusType, uint256) external payable returns (uint256 reqId)
    {
        reqId = nextRequestId++;
        pending[reqId] = Pending(cb, sel, payload);
    }
    function deliverString(uint256 reqId, string memory s) external {
        Pending memory p = pending[reqId]; delete pending[reqId];
        Response[] memory resps = new Response[](1);
        resps[0] = Response({validator: address(this), result: abi.encode(s), status: ResponseStatus.Success,
                             receipt: 0, timestamp: block.timestamp, executionCost: 0});
        Request memory req;
        (bool ok, ) = p.callbackAddress.call(abi.encodeWithSelector(p.selector, reqId, resps, ResponseStatus.Success, req));
        require(ok, "cb failed");
    }
    function deliverUint(uint256 reqId, uint256 v) external {
        Pending memory p = pending[reqId]; delete pending[reqId];
        Response[] memory resps = new Response[](1);
        resps[0] = Response({validator: address(this), result: abi.encode(v), status: ResponseStatus.Success,
                             receipt: 0, timestamp: block.timestamp, executionCost: 0});
        Request memory req;
        (bool ok, ) = p.callbackAddress.call(abi.encodeWithSelector(p.selector, reqId, resps, ResponseStatus.Success, req));
        require(ok, "cb failed");
    }
    receive() external payable {}
}

contract LeagueSchedulerTest is Test {
    MockPlatform3 plat;
    AgentRegistry reg;
    Treasury treas;
    Arena arena;
    LeagueScheduler sched;

    address constant PRECOMPILE = address(0x0100);

    // Pre-existing agents with varying ELO so top-K picks deterministically
    uint256 hi1; uint256 hi2; uint256 hi3; uint256 hi4; uint256 lo;

    function setUp() public {
        plat = new MockPlatform3();
        reg = new AgentRegistry(address(this));
        treas = new Treasury(address(this), address(this));
        arena = new Arena(address(plat), address(reg), address(treas), address(this));
        reg.setOperator(address(arena), true);
        treas.setOperator(address(arena), true);

        // Mint 5 agents; we'll set ELO so [hi1, hi2, hi3, hi4] sit on top of [lo]
        hi1 = reg.mint(address(0xA1), keccak256("h1"), "u", "Hi1");
        hi2 = reg.mint(address(0xA2), keccak256("h2"), "u", "Hi2");
        hi3 = reg.mint(address(0xA3), keccak256("h3"), "u", "Hi3");
        hi4 = reg.mint(address(0xA4), keccak256("h4"), "u", "Hi4");
        lo  = reg.mint(address(0xA5), keccak256("lo"), "u", "Lo");
        reg.setOperator(address(this), true);
        reg.recordResult(hi1, 1700, true);
        reg.recordResult(hi2, 1680, true);
        reg.recordResult(hi3, 1660, true);
        reg.recordResult(hi4, 1640, true);
        reg.recordResult(lo,  1400, false);

        // Use MatchFinalized(uint256,uint256[],int256[],uint256) topic — taken from Arena's emitted event
        bytes32 topic = keccak256("MatchFinalized(uint256,uint256[],int256[],uint256)");
        sched = new LeagueScheduler(address(reg), address(arena), topic, address(this));
        reg.setOperator(address(sched), true);

        // Two lots, owner-set.
        Arena.LotTemplate[] memory lots = new Arena.LotTemplate[](2);
        lots[0] = Arena.LotTemplate("ETH-USD", "u", "data.amount", 0, 1, "~2000");
        lots[1] = Arena.LotTemplate("SOL-USD", "u", "data.amount", 0, 1, "~85");
        sched.setLotTemplates(lots);

        // Fund scheduler well above 32 STT gate + one match cost
        vm.deal(address(sched), 200 ether);
    }

    function testTopJoinablePicksByElo() public {
        // Open a match via the manual poke; should seat [hi1, hi2, hi3, hi4] not lo
        sched.pokeOpenNext();
        // matchId = 1 in fresh Arena
        (, , uint256[] memory ids, , , , , ) = arena.getMatch(1);
        assertEq(ids.length, 4);
        assertTrue(ids[0] == hi1 && ids[1] == hi2 && ids[2] == hi3 && ids[3] == hi4,
            "top 4 by ELO seated, low-ELO excluded");
    }

    function testReactiveCallbackOpensNextMatch() public {
        // Fake the precompile calling onEvent on the scheduler.
        bytes32[] memory topics = new bytes32[](1);
        topics[0] = keccak256("MatchFinalized(uint256,uint256[],int256[],uint256)");
        vm.prank(PRECOMPILE);
        sched.onEvent(address(arena), topics, hex"");
        // Should have scheduled match #1
        assertEq(sched.matchesScheduled(), 1);
        assertEq(sched.callbacksReceived(), 1);
    }

    function testStallEmitsWhenUnderfunded() public {
        // Drop balance below threshold (set threshold to 200 ether so we're under)
        sched.setMinBalanceThreshold(500 ether);
        vm.recordLogs();
        vm.prank(PRECOMPILE);
        bytes32[] memory topics = new bytes32[](1);
        topics[0] = keccak256("MatchFinalized(uint256,uint256[],int256[],uint256)");
        sched.onEvent(address(arena), topics, hex"");
        // No match scheduled
        assertEq(sched.matchesScheduled(), 0);
        // SchedulerStalled emitted
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool sawStalled = false;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == keccak256("SchedulerStalled(uint256,uint256)")) sawStalled = true;
        }
        assertTrue(sawStalled, "SchedulerStalled fires when underfunded");
    }

    function testStallEmitsWhenTooFewJoinable() public {
        // Open a match using the manual poke first → consumes top 4 agents (joinable=false)
        sched.pokeOpenNext();
        // Now there's only `lo` joinable (4 < 4 already-seated, only 1 left).
        vm.recordLogs();
        vm.prank(PRECOMPILE);
        bytes32[] memory topics = new bytes32[](1);
        topics[0] = keccak256("MatchFinalized(uint256,uint256[],int256[],uint256)");
        sched.onEvent(address(arena), topics, hex"");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool sawStalled = false;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == keccak256("SchedulerStalled(uint256,uint256)")) sawStalled = true;
        }
        assertTrue(sawStalled, "SchedulerStalled fires when not enough joinable agents");
    }

    function testNonPrecompileCannotInvokeCallback() public {
        bytes32[] memory topics = new bytes32[](1);
        topics[0] = keccak256("MatchFinalized(uint256,uint256[],int256[],uint256)");
        vm.expectRevert(); // OnlyReactivityPrecompile()
        sched.onEvent(address(arena), topics, hex"");
    }

    function testOwnerCanReplaceLotTemplates() public {
        Arena.LotTemplate[] memory lots = new Arena.LotTemplate[](1);
        lots[0] = Arena.LotTemplate("BTC-USD", "u", "data.amount", 0, 1, "~95000");
        sched.setLotTemplates(lots);
        Arena.LotTemplate[] memory got = sched.getLotTemplates();
        assertEq(got.length, 1);
        assertEq(got[0].category, "BTC-USD");
    }
}
