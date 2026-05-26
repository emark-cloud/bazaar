// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {VRFSpike} from "../../src/spikes/VRFSpike.sol";

contract DeployVRFSpike is Script {
    function run() external {
        address wrapper = vm.envAddress("VRF_WRAPPER_TESTNET");
        vm.startBroadcast();
        VRFSpike spike = new VRFSpike(wrapper);
        vm.stopBroadcast();
        console2.log("VRFSpike", address(spike));
        console2.log("VRF wrapper", wrapper);
    }
}
