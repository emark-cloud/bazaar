// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {MoveDecider} from "../../src/spikes/MoveDecider.sol";
import {JsonApiSpike} from "../../src/spikes/JsonApiSpike.sol";
import {InferStringSpike} from "../../src/spikes/InferStringSpike.sol";
import {InferToolsChatSpike} from "../../src/spikes/InferToolsChatSpike.sol";
import {ParseWebsiteSpike} from "../../src/spikes/ParseWebsiteSpike.sol";

/// Deploys all Phase 0 spike contracts in one broadcast.
/// Usage:
///   source .env
///   forge script contracts/script/phase0/DeploySpikes.s.sol:DeploySpikes \
///       --rpc-url $TESTNET_RPC --private-key $PRIVATE_KEY --broadcast
contract DeploySpikes is Script {
    function run() external {
        address platform = vm.envAddress("PLATFORM_TESTNET");

        vm.startBroadcast();
        MoveDecider moveDecider = new MoveDecider(platform);
        JsonApiSpike jsonApi = new JsonApiSpike(platform);
        InferStringSpike inferString = new InferStringSpike(platform);
        InferToolsChatSpike toolsChat = new InferToolsChatSpike(platform);
        ParseWebsiteSpike parseWebsite = new ParseWebsiteSpike(platform);
        vm.stopBroadcast();

        console2.log("=== Phase 0 spike deployments ===");
        console2.log("MoveDecider        ", address(moveDecider));
        console2.log("JsonApiSpike       ", address(jsonApi));
        console2.log("InferStringSpike   ", address(inferString));
        console2.log("InferToolsChatSpike", address(toolsChat));
        console2.log("ParseWebsiteSpike  ", address(parseWebsite));
    }
}
