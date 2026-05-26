// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {AuditCouncil} from "../src/AuditCouncil.sol";
import {Arena} from "../src/Arena.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {Treasury} from "../src/Treasury.sol";
import {Request, Response, ResponseStatus, ConsensusType} from "../src/interfaces/IAgentPlatform.sol";

/// Mock VRF wrapper: records calls, lets the test deliver deterministic random words via rawFulfillRandomWords.
contract MockVRFWrapper {
    uint256 public nextId = 1;
    mapping(uint256 => address) public consumerOf;
    mapping(uint256 => uint32)  public numWordsOf;

    function calculateRequestPriceNative(uint32, uint32) external pure returns (uint256) {
        return 0.001 ether;
    }

    function requestRandomWordsInNative(
        uint32 /*gas*/,
        uint16 /*confs*/,
        uint32 numWords,
        bytes calldata /*extra*/
    ) external payable returns (uint256 requestId) {
        requestId = nextId++;
        consumerOf[requestId] = msg.sender;
        numWordsOf[requestId] = numWords;
    }

    function deliver(uint256 requestId, uint256[] memory words) external {
        address c = consumerOf[requestId];
        require(c != address(0), "unknown");
        (bool ok, ) = c.call(abi.encodeWithSignature(
            "rawFulfillRandomWords(uint256,uint256[])", requestId, words
        ));
        require(ok, "fulfill failed");
    }

    function lastRequestId() external view returns (uint256) { return nextId - 1; }
}

/// Mock platform — supports verdict (string) + parse-website (uint) Threshold responses.
contract MockPlatform2 {
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

    function createAdvancedRequest(
        uint256, address cb, bytes4 sel, bytes calldata payload,
        uint256, uint256, ConsensusType, uint256
    ) external payable returns (uint256 reqId) {
        reqId = nextRequestId++;
        pending[reqId] = Pending(cb, sel, payload);
    }

    /// Deliver string-typed Threshold responses (used for inferString verdicts).
    function deliverStrings(uint256 reqId, string[] memory results, ResponseStatus[] memory statuses) external {
        Pending memory p = pending[reqId];
        delete pending[reqId];
        Response[] memory resps = new Response[](results.length);
        for (uint256 i = 0; i < results.length; i++) {
            resps[i] = Response({
                validator: address(this),
                result: abi.encode(results[i]),
                status: statuses[i],
                receipt: 0, timestamp: block.timestamp, executionCost: 0
            });
        }
        Request memory req;
        (bool ok, ) = p.callbackAddress.call(abi.encodeWithSelector(
            p.selector, reqId, resps, ResponseStatus.Success, req
        ));
        require(ok, "verdict cb failed");
    }

    /// Deliver uint-typed Threshold responses (used for parse-website cross-checks).
    function deliverUints(uint256 reqId, uint256[] memory values, ResponseStatus[] memory statuses) external {
        Pending memory p = pending[reqId];
        delete pending[reqId];
        Response[] memory resps = new Response[](values.length);
        for (uint256 i = 0; i < values.length; i++) {
            resps[i] = Response({
                validator: address(this),
                result: abi.encode(values[i]),
                status: statuses[i],
                receipt: 0, timestamp: block.timestamp, executionCost: 0
            });
        }
        Request memory req;
        (bool ok, ) = p.callbackAddress.call(abi.encodeWithSelector(
            p.selector, reqId, resps, ResponseStatus.Success, req
        ));
        require(ok, "parse cb failed");
    }

    function deliverFail(uint256 reqId) external {
        Pending memory p = pending[reqId];
        delete pending[reqId];
        Response[] memory resps;
        Request memory req;
        (bool ok, ) = p.callbackAddress.call(abi.encodeWithSelector(
            p.selector, reqId, resps, ResponseStatus.Failed, req
        ));
        require(ok, "cb failed");
    }

    receive() external payable {}
}

contract AuditCouncilTest is Test {
    MockPlatform2 plat;
    MockVRFWrapper vrf;
    AgentRegistry reg;
    Treasury treas;
    AuditCouncil council;

    address constant ARENA = address(0xA7E);  // not real Arena — we impersonate via vm.prank

    uint256 hawk; uint256 diplo; uint256 quant; uint256 contra;
    uint256 auditor1; uint256 auditor2; uint256 auditor3; uint256 auditor4; uint256 auditor5;

    function setUp() public {
        plat   = new MockPlatform2();
        vrf    = new MockVRFWrapper();
        reg    = new AgentRegistry(address(this));
        treas  = new Treasury(address(this), address(this));
        council = new AuditCouncil(address(plat), address(vrf), address(reg), address(treas), address(this));
        council.setArena(ARENA);

        // Mint 4 competitors + 5 candidate auditors
        hawk    = reg.mint(address(0xAA1), keccak256("h"), "u", "Hawk");
        diplo   = reg.mint(address(0xAA2), keccak256("d"), "u", "Diplo");
        quant   = reg.mint(address(0xAA3), keccak256("q"), "u", "Quant");
        contra  = reg.mint(address(0xAA4), keccak256("c"), "u", "Contra");
        auditor1 = reg.mint(address(0xB1), keccak256("a1"), "u", "Aud1");
        auditor2 = reg.mint(address(0xB2), keccak256("a2"), "u", "Aud2");
        auditor3 = reg.mint(address(0xB3), keccak256("a3"), "u", "Aud3");
        auditor4 = reg.mint(address(0xB4), keccak256("a4"), "u", "Aud4");
        auditor5 = reg.mint(address(0xB5), keccak256("a5"), "u", "Aud5");

        // Treasury escrow for an in-flight match (matchId = 99)
        uint256[] memory ids = new uint256[](4);
        address[] memory owners = new address[](4);
        ids[0] = hawk;   owners[0] = address(0xAA1);
        ids[1] = diplo;  owners[1] = address(0xAA2);
        ids[2] = quant;  owners[2] = address(0xAA3);
        ids[3] = contra; owners[3] = address(0xAA4);
        treas.setOperator(address(this), true);    // for escrowing in setUp
        treas.setOperator(address(council), true); // for freeze/settle/refund
        vm.deal(address(this), 1000 ether);
        treas.escrowMatch{value: 100 ether}(99, ids, owners, 25 ether);

        vm.deal(address(council), 10 ether); // fund VRF + agent fees
    }

    function _beginAuditClean() internal returns (uint256 vrfId) {
        uint256[] memory competitors = new uint256[](4);
        competitors[0] = hawk; competitors[1] = diplo; competitors[2] = quant; competitors[3] = contra;
        uint256[] memory ranked = new uint256[](4);
        ranked[0] = hawk; ranked[1] = diplo; ranked[2] = quant; ranked[3] = contra;
        string[]  memory cats = new string[](1); cats[0] = "ETH-USD";
        string[]  memory urls = new string[](1); urls[0] = "https://simple.example/eth";
        uint8[]   memory pages = new uint8[](1); pages[0] = 1;
        uint256[] memory feeds = new uint256[](1); feeds[0] = 2000;

        vm.prank(ARENA);
        council.beginAudit(99, competitors, ranked, cats, urls, pages, feeds);
        vrfId = 1; // first VRF request from mock wrapper
    }

    function testCleanAuditUnfreezesAndSettles() public {
        // Zero owner balances to make payout assertions clean
        vm.deal(address(0xAA1), 0); vm.deal(address(0xAA2), 0);
        vm.deal(address(0xAA3), 0); vm.deal(address(0xAA4), 0);

        _beginAuditClean();
        // Treasury should be frozen
        (, , , , , , uint256 frozenUntil) = treas.getEscrow(99);
        assertGt(frozenUntil, block.timestamp);

        // VRF callback selects auditors. Random words pick non-competitors.
        uint256[] memory words = new uint256[](3);
        words[0] = 0; words[1] = 1; words[2] = 2; // shuffle index into the eligible[] (auditor1..5)
        vrf.deliver(1, words);

        // After VRF fulfillment, 3 verdict requests + 1 parse-check request fired.
        // Next requestIds on plat: 1,2,3 = verdicts; 4 = parse check.
        // Deliver clean from each auditor (3 of 5 clean → threshold met).
        string[] memory cleansArr = new string[](5);
        for (uint256 i = 0; i < 5; i++) cleansArr[i] = "clean";
        ResponseStatus[] memory okstat = new ResponseStatus[](5);
        for (uint256 i = 0; i < 5; i++) okstat[i] = ResponseStatus.Success;

        plat.deliverStrings(1, cleansArr, okstat);
        plat.deliverStrings(2, cleansArr, okstat);
        plat.deliverStrings(3, cleansArr, okstat);

        // Parse-check returns values close to feed (2000) → not suspect
        uint256[] memory parseVals = new uint256[](5);
        parseVals[0] = 1998; parseVals[1] = 2001; parseVals[2] = 2000; parseVals[3] = 1995; parseVals[4] = 2005;
        plat.deliverUints(4, parseVals, okstat);

        // Audit should be finalized now → Treasury settled
        (AuditCouncil.AuditStatus status, , , , , , , , ) = council.getAudit(99);
        assertEq(uint256(status), uint256(AuditCouncil.AuditStatus.Finalized));

        // Owners received payouts (4-agent split = 50/28/15/7 of 95 ether)
        assertEq(address(0xAA1).balance, 95 ether * 50 / 100);
        assertEq(address(0xAA2).balance, 95 ether * 28 / 100);
        assertEq(address(0xAA3).balance, 95 ether * 15 / 100);
        assertEq(address(0xAA4).balance, 95 ether *  7 / 100);
        assertEq(treas.seasonFund(), 5 ether);
    }

    function testSuspectQuorumRefundsEntrants() public {
        vm.deal(address(0xAA1), 0); vm.deal(address(0xAA2), 0);
        vm.deal(address(0xAA3), 0); vm.deal(address(0xAA4), 0);

        _beginAuditClean();
        uint256[] memory words = new uint256[](3);
        words[0] = 0; words[1] = 1; words[2] = 2;
        vrf.deliver(1, words);

        // 2-of-3 verdicts suspect → quorum suspect
        string[] memory suspectsArr = new string[](5);
        for (uint256 i = 0; i < 5; i++) suspectsArr[i] = "suspect";
        string[] memory cleansArr = new string[](5);
        for (uint256 i = 0; i < 5; i++) cleansArr[i] = "clean";
        ResponseStatus[] memory okstat = new ResponseStatus[](5);
        for (uint256 i = 0; i < 5; i++) okstat[i] = ResponseStatus.Success;

        plat.deliverStrings(1, suspectsArr, okstat);
        plat.deliverStrings(2, suspectsArr, okstat);
        plat.deliverStrings(3, cleansArr, okstat);
        // Parse check passes — but verdict quorum is what trips suspect
        uint256[] memory parseVals = new uint256[](5);
        parseVals[0] = 1998; parseVals[1] = 2001; parseVals[2] = 2000; parseVals[3] = 1995; parseVals[4] = 2005;
        plat.deliverUints(4, parseVals, okstat);

        (AuditCouncil.AuditStatus status, , , , , , , , ) = council.getAudit(99);
        assertEq(uint256(status), uint256(AuditCouncil.AuditStatus.Finalized));

        // Refund path: each entrant got pot / 4 = 25 ether
        assertEq(address(0xAA1).balance, 25 ether);
        assertEq(address(0xAA2).balance, 25 ether);
        assertEq(address(0xAA3).balance, 25 ether);
        assertEq(address(0xAA4).balance, 25 ether);
        assertEq(treas.seasonFund(), 0, "no rake on refund");
    }

    function testParseDriftTripsSuspect() public {
        vm.deal(address(0xAA1), 0); vm.deal(address(0xAA2), 0);
        vm.deal(address(0xAA3), 0); vm.deal(address(0xAA4), 0);

        _beginAuditClean();
        uint256[] memory words = new uint256[](3);
        words[0] = 0; words[1] = 1; words[2] = 2;
        vrf.deliver(1, words);

        string[] memory cleansArr = new string[](5);
        for (uint256 i = 0; i < 5; i++) cleansArr[i] = "clean";
        ResponseStatus[] memory okstat = new ResponseStatus[](5);
        for (uint256 i = 0; i < 5; i++) okstat[i] = ResponseStatus.Success;
        plat.deliverStrings(1, cleansArr, okstat);
        plat.deliverStrings(2, cleansArr, okstat);
        plat.deliverStrings(3, cleansArr, okstat);

        // Parse-check median = 4000 vs feed 2000 → 100% drift, well beyond 10% tolerance → suspect
        uint256[] memory parseVals = new uint256[](5);
        parseVals[0] = 4000; parseVals[1] = 4001; parseVals[2] = 4000; parseVals[3] = 3995; parseVals[4] = 4005;
        plat.deliverUints(4, parseVals, okstat);

        (AuditCouncil.AuditStatus status, , , , , , , uint8 parseChecksSuspect, ) = council.getAudit(99);
        assertEq(uint256(status), uint256(AuditCouncil.AuditStatus.Finalized));
        assertEq(parseChecksSuspect, 1);

        // Refund path triggered → entrants refunded equally
        assertEq(address(0xAA1).balance, 25 ether);
    }

    function testAppealTimeoutFailsOpenClean() public {
        vm.deal(address(0xAA1), 0); vm.deal(address(0xAA2), 0);
        vm.deal(address(0xAA3), 0); vm.deal(address(0xAA4), 0);
        _beginAuditClean();

        // Don't fulfill VRF or any verdicts. Skip past appealUntil.
        skip(council.appealWindowSeconds() + 1);
        council.appealTimeout(99);

        // Settlement path taken → owners paid by rank
        assertEq(address(0xAA1).balance, 95 ether * 50 / 100);
    }

    function testCompetitorsExcludedFromAuditors() public {
        _beginAuditClean();
        // Pick words that would hash to competitor positions if competitors weren't excluded.
        // We can't easily control eligible[] internals, but we assert the post-VRF auditorIds are all in [auditor1..5].
        uint256[] memory words = new uint256[](3);
        words[0] = 0; words[1] = 1; words[2] = 2;
        vrf.deliver(1, words);

        ( , , uint256[] memory auditorIds, , , , , , ) = council.getAudit(99);
        for (uint256 i = 0; i < auditorIds.length; i++) {
            assertTrue(auditorIds[i] != hawk && auditorIds[i] != diplo
                    && auditorIds[i] != quant && auditorIds[i] != contra,
                "auditor must not be a competitor");
        }
    }

    function testNonArenaCannotBegin() public {
        uint256[] memory empty1 = new uint256[](0);
        string[]  memory emptys = new string[](0);
        uint8[]   memory emptyp = new uint8[](0);
        vm.expectRevert();
        council.beginAudit(7, empty1, empty1, emptys, emptys, emptyp, empty1);
    }
}
