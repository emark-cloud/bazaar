// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ParseWebsiteSpike} from "../../src/spikes/ParseWebsiteSpike.sol";

contract DeployParseSpike is Script {
    function run() external {
        address platform = vm.envAddress("PLATFORM_TESTNET");
        vm.startBroadcast();
        ParseWebsiteSpike spike = new ParseWebsiteSpike(platform);
        vm.stopBroadcast();
        console2.log("ParseWebsiteSpike (v2)", address(spike));
    }
}
