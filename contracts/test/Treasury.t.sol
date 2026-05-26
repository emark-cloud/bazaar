// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Treasury} from "../src/Treasury.sol";

contract TreasuryTest is Test {
    Treasury t;
    address owner = address(0xA1);
    address seasonRecipient = address(0xC0FFEE);
    address operator = address(0xB1);
    address ag1 = address(0x111);
    address ag2 = address(0x222);
    address ag3 = address(0x333);
    address ag4 = address(0x444);

    function setUp() public {
        t = new Treasury(owner, seasonRecipient);
        vm.prank(owner);
        t.setOperator(operator, true);
        vm.deal(operator, 1000 ether);
        vm.deal(address(this), 1000 ether);
    }

    function _agentIds() internal pure returns (uint256[] memory ids) {
        ids = new uint256[](4);
        ids[0]=1; ids[1]=2; ids[2]=3; ids[3]=4;
    }
    function _owners() internal view returns (address[] memory os) {
        os = new address[](4);
        os[0]=ag1; os[1]=ag2; os[2]=ag3; os[3]=ag4;
    }

    function testEscrowAndSettlePayouts() public {
        uint256[] memory ids = _agentIds();
        address[] memory owners = _owners();
        vm.prank(operator);
        t.escrowMatch{value: 100 ether}(1, ids, owners, 25 ether);

        // Rank: 1 wins, then 3, then 2, then 4 forfeited
        uint256[] memory ranked = new uint256[](4);
        ranked[0]=1; ranked[1]=3; ranked[2]=2; ranked[3]=4;

        // Pot=100. Rake 5% = 5. Distributable = 95.
        // Weights 50/28/15/7 → 47.5 / 26.6 / 14.25 / 6.65 ; integer math floors then dust → winner
        uint256 b1 = ag1.balance; uint256 b3 = ag3.balance; uint256 b2 = ag2.balance; uint256 b4 = ag4.balance;
        vm.prank(operator);
        t.settleMatch(1, ranked);

        // 50% of 95 = 47.5 ether → 47e18 + dust. weights are integer percentages so 95*50/100 = 47.5e18
        // 50/28/15/7 sums to 100 exactly; with ether-scale numbers there's no integer dust.
        assertEq(ag1.balance - b1, 95 ether * 50 / 100, "winner gets 50%");
        assertEq(ag3.balance - b3, 95 ether * 28 / 100, "2nd gets 28%");
        assertEq(ag2.balance - b2, 95 ether * 15 / 100, "3rd gets 15%");
        assertEq(ag4.balance - b4, 95 ether * 7 / 100, "4th gets 7%");
        assertEq(t.seasonFund(), 5 ether, "rake to season fund");
    }

    function testFreezeBlocksSettle() public {
        uint256[] memory ids = _agentIds();
        address[] memory owners = _owners();
        vm.prank(operator);
        t.escrowMatch{value: 100 ether}(1, ids, owners, 25 ether);
        vm.prank(operator);
        t.freezeMatch(1, block.timestamp + 1 days);

        uint256[] memory ranked = new uint256[](4);
        ranked[0]=1; ranked[1]=2; ranked[2]=3; ranked[3]=4;
        vm.prank(operator);
        vm.expectRevert();
        t.settleMatch(1, ranked);

        // unfreeze and retry
        vm.prank(operator);
        t.unfreezeMatch(1);
        vm.prank(operator);
        t.settleMatch(1, ranked);
        assertGt(ag1.balance, 0);
    }

    function testRefundOnVoid() public {
        uint256[] memory ids = _agentIds();
        address[] memory owners = _owners();
        vm.prank(operator);
        t.escrowMatch{value: 100 ether}(1, ids, owners, 25 ether);
        uint256 b1 = ag1.balance; uint256 b2 = ag2.balance; uint256 b3 = ag3.balance; uint256 b4 = ag4.balance;
        vm.prank(operator);
        t.refundMatch(1);
        assertEq(ag1.balance - b1, 25 ether);
        assertEq(ag2.balance - b2, 25 ether);
        assertEq(ag3.balance - b3, 25 ether);
        assertEq(ag4.balance - b4, 25 ether);
        assertEq(t.seasonFund(), 0);
    }

    function testBadStakeAmountReverts() public {
        uint256[] memory ids = _agentIds();
        address[] memory owners = _owners();
        vm.prank(operator);
        vm.expectRevert();
        t.escrowMatch{value: 99 ether}(1, ids, owners, 25 ether);
    }

    function testNonOperatorBlocked() public {
        uint256[] memory ids = _agentIds();
        address[] memory owners = _owners();
        vm.expectRevert();
        t.escrowMatch{value: 100 ether}(1, ids, owners, 25 ether);
    }

    function testRakeAccumulatesAndDrains() public {
        // two matches → 10 ether rake total
        uint256[] memory ids = _agentIds();
        address[] memory owners = _owners();
        uint256[] memory ranked = new uint256[](4);
        ranked[0]=1; ranked[1]=2; ranked[2]=3; ranked[3]=4;

        vm.prank(operator);
        t.escrowMatch{value: 100 ether}(1, ids, owners, 25 ether);
        vm.prank(operator);
        t.settleMatch(1, ranked);

        vm.prank(operator);
        t.escrowMatch{value: 100 ether}(2, ids, owners, 25 ether);
        vm.prank(operator);
        t.settleMatch(2, ranked);

        assertEq(t.seasonFund(), 10 ether);
        uint256 recip = seasonRecipient.balance;
        vm.prank(owner);
        t.drainSeasonFund();
        assertEq(seasonRecipient.balance - recip, 10 ether);
        assertEq(t.seasonFund(), 0);
    }
}
