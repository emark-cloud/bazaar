// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {InferToolsChatSpike} from "../../src/spikes/InferToolsChatSpike.sol";

contract DeployToolsChatSpike is Script {
    function run() external {
        address platform = vm.envAddress("PLATFORM_TESTNET");
        vm.startBroadcast();
        InferToolsChatSpike spike = new InferToolsChatSpike(platform);
        vm.stopBroadcast();
        console2.log("InferToolsChatSpike (v2)", address(spike));
    }
}
