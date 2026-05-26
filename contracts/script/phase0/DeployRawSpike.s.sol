// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {RawSelectorSpike} from "../../src/spikes/RawSelectorSpike.sol";

contract DeployRawSpike is Script {
    function run() external {
        address platform = vm.envAddress("PLATFORM_TESTNET");
        vm.startBroadcast();
        RawSelectorSpike spike = new RawSelectorSpike(platform);
        vm.stopBroadcast();
        console2.log("RawSelectorSpike", address(spike));
    }
}
