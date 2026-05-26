// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {AuditCouncil} from "../../src/AuditCouncil.sol";
import {AgentRegistry} from "../../src/AgentRegistry.sol";
import {Treasury} from "../../src/Treasury.sol";
import {Arena} from "../../src/Arena.sol";

/// Phase 3 deploy:
///   1. Deploy a fresh Arena (v3) wired to the existing Registry + Treasury.
///   2. Deploy AuditCouncil pointing at the VRF wrapper + Registry + Treasury.
///   3. Wire: Arena.auditCouncil = council; Treasury operator(s) = Arena AND Council;
///      Registry operator = Arena (auditors are read-only — Council doesn't need write access).
///   4. Mint 3 additional "auditor" agents (auditor pool can't overlap with competitors).
///   5. Top up Council balance with operating STT (enough for one VRF + 3 verdicts + 2 parse checks).
contract DeployPhase3 is Script {
    function run() external {
        address platform   = vm.envAddress("PLATFORM_TESTNET");
        address registry_  = vm.envAddress("AGENT_REGISTRY");
        address treasury_  = vm.envAddress("TREASURY");
        address vrfWrap    = vm.envAddress("VRF_WRAPPER_TESTNET");
        uint256 pk         = vm.envUint("PRIVATE_KEY");
        address deployer   = vm.addr(pk);

        vm.startBroadcast(pk);

        // 1. Arena v3
        Arena arena = new Arena(platform, registry_, treasury_, deployer);

        // 2. AuditCouncil
        AuditCouncil council = new AuditCouncil(platform, vrfWrap, registry_, treasury_, deployer);
        council.setArena(address(arena));

        // 3. Wiring
        arena.setAuditCouncil(address(council));
        AgentRegistry(registry_).setOperator(address(arena), true);
        // Old Phase-2 Arena is still an operator on Treasury; that's fine. Add the new ones.
        Treasury(payable(treasury_)).setOperator(address(arena),   true);
        Treasury(payable(treasury_)).setOperator(address(council), true);

        // 4. Auditor agent pool — 3 minimum (one per VRF word). Use neutral judge personas.
        uint256 judgeA = AgentRegistry(registry_).mint(
            deployer, keccak256("judge-a"), "https://github.com/bazaar/personas/judge-a.md", "JudgeA"
        );
        uint256 judgeB = AgentRegistry(registry_).mint(
            deployer, keccak256("judge-b"), "https://github.com/bazaar/personas/judge-b.md", "JudgeB"
        );
        uint256 judgeC = AgentRegistry(registry_).mint(
            deployer, keccak256("judge-c"), "https://github.com/bazaar/personas/judge-c.md", "JudgeC"
        );

        // 5. Fund the council for one full audit cycle.
        //    VRF ~0.003 STT + 3 verdicts × 0.5 STT advanced deposit + 2 parse × 0.6 STT = ~3.4 STT.
        //    Fund 5 STT for headroom.
        (bool ok, ) = address(council).call{value: 5 ether}("");
        require(ok, "council fund failed");

        vm.stopBroadcast();

        console2.log("=== Phase 3 deployments ===");
        console2.log("Arena (v3)      ", address(arena));
        console2.log("AuditCouncil    ", address(council));
        console2.log("JudgeA agentId  ", judgeA);
        console2.log("JudgeB agentId  ", judgeB);
        console2.log("JudgeC agentId  ", judgeC);
    }
}
