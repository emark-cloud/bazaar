// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {Treasury} from "../../src/Treasury.sol";
import {Arena} from "../../src/Arena.sol";
import {AgentRegistry} from "../../src/AgentRegistry.sol";

/// Phase 2 deploy: Treasury + new Arena wired to it.
/// Reuses the existing AgentRegistry from Phase 1 (the personas remain valid).
contract DeployPhase2 is Script {
    function run() external {
        address platform = vm.envAddress("PLATFORM_TESTNET");
        address registry_ = vm.envAddress("AGENT_REGISTRY");
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);

        Treasury treasury = new Treasury(deployer, deployer);
        Arena arena = new Arena(platform, registry_, address(treasury), deployer);

        // Wire: Arena is operator on both Registry and Treasury.
        AgentRegistry(registry_).setOperator(address(arena), true);
        treasury.setOperator(address(arena), true);

        vm.stopBroadcast();

        console2.log("=== Phase 2 deployments ===");
        console2.log("Treasury  ", address(treasury));
        console2.log("Arena (v2)", address(arena));
        console2.log("(Registry unchanged)", registry_);
    }
}
