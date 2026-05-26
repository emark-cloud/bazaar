// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";

contract AgentRegistryTest is Test {
    AgentRegistry reg;
    address owner = address(0xA1);
    address operator = address(0xB1);
    address user = address(0xC1);

    function setUp() public {
        reg = new AgentRegistry(owner);
        vm.prank(owner);
        reg.setOperator(operator, true);
    }

    function _mint(address to, string memory name_) internal returns (uint256 id) {
        bytes32 h = keccak256(bytes(name_));
        return reg.mint(to, h, "ipfs://prompt", name_);
    }

    function testMintAndGet() public {
        uint256 id = _mint(user, "Hawk");
        AgentRegistry.Agent memory a = reg.getAgent(id);
        assertEq(a.name, "Hawk");
        assertEq(a.elo, 1500);
        assertTrue(a.joinable);
        assertEq(reg.ownerOf(id), user);
    }

    function testOperatorCanLockAndScore() public {
        uint256 id = _mint(user, "Hawk");
        vm.prank(operator);
        reg.setJoinable(id, false);
        assertFalse(reg.getAgent(id).joinable);

        vm.prank(operator);
        reg.recordResult(id, 1524, true);
        AgentRegistry.Agent memory a = reg.getAgent(id);
        assertEq(a.elo, 1524);
        assertEq(a.matches, 1);
        assertEq(a.wins, 1);
    }

    function testNonOperatorBlocked() public {
        uint256 id = _mint(user, "Hawk");
        vm.expectRevert();
        reg.setJoinable(id, false);
    }

    function testListJoinable() public {
        _mint(user, "Hawk");
        _mint(user, "Diplomat");
        uint256 id3 = _mint(user, "Quant");
        vm.prank(operator);
        reg.setJoinable(id3, false);

        (uint256[] memory ids, ) = reg.listJoinable(0, 10);
        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 2);
    }
}
