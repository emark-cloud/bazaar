// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {ReactivitySpike} from "../../src/spikes/ReactivitySpike.sol";

/// Deploy ReactivitySpike, fund with 33 STT (subscription-owner balance gate is 32),
/// then create the on-chain subscription to its own Ping event.
contract DeployReactivitySpike is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        ReactivitySpike spike = new ReactivitySpike{value: 33 ether}();
        uint256 subId = spike.subscribeSelf();
        vm.stopBroadcast();
        console2.log("ReactivitySpike", address(spike));
        console2.log("subscriptionId ", subId);
    }
}
