// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {AgentRegistry} from "../../src/AgentRegistry.sol";
import {Arena} from "../../src/Arena.sol";

/// Deploys AgentRegistry + Arena, wires Arena as a registry operator,
/// mints the 4 default personas to the deployer, and prints all addresses.
contract Deploy is Script {
    function run() external {
        address platform = vm.envAddress("PLATFORM_TESTNET");
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);

        AgentRegistry registry = new AgentRegistry(deployer);
        // Phase 1 had no Treasury — pass zero address for the Arena's treasury slot.
        // Phase 2 deploys add Treasury and re-deploy Arena pointing at it.
        Arena arena = new Arena(platform, address(registry), address(0));
        registry.setOperator(address(arena), true);

        // Mint 4 default personas. Owners = deployer; strategies pinned at simple URIs
        // (production would point to an IPFS hash; for the demo we use github raw URLs that
        // anyone can read).
        uint256 hawk = registry.mint(
            deployer,
            keccak256(bytes("Aggressive accumulator. Buy aggressive early on high-conviction lots.")),
            "https://github.com/bazaar/personas/hawk.md",
            "Hawk"
        );
        uint256 diplomat = registry.mint(
            deployer,
            keccak256(bytes("Coalition-seeker. Form alliances; trade lower per-lot profit for stability.")),
            "https://github.com/bazaar/personas/diplomat.md",
            "Diplomat"
        );
        uint256 quant = registry.mint(
            deployer,
            keccak256(bytes("Data-driven, intel-heavy. Bid only when confidence is high.")),
            "https://github.com/bazaar/personas/quant.md",
            "Quant"
        );
        uint256 contrarian = registry.mint(
            deployer,
            keccak256(bytes("Fade the room. Bid on what no one else wants; sell into hype.")),
            "https://github.com/bazaar/personas/contrarian.md",
            "Contrarian"
        );

        vm.stopBroadcast();

        console2.log("=== Phase 1 deployments ===");
        console2.log("AgentRegistry", address(registry));
        console2.log("Arena        ", address(arena));
        console2.log("Personas:");
        console2.log("  Hawk      ", hawk);
        console2.log("  Diplomat  ", diplomat);
        console2.log("  Quant     ", quant);
        console2.log("  Contrarian", contrarian);
    }
}
