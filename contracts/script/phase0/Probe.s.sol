// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {IAgentPlatform} from "../../src/interfaces/IAgentPlatform.sol";

/// Read-only probe of platform parameters. No broadcast, no STT spent.
///   forge script contracts/script/phase0/Probe.s.sol:Probe --rpc-url $TESTNET_RPC
contract Probe is Script {
    function run() external view {
        address platform = vm.envAddress("PLATFORM_TESTNET");
        IAgentPlatform p = IAgentPlatform(platform);

        uint256 floor = p.getRequestDeposit();
        uint256 minPer = p.minPerAgentDeposit();

        console2.log("Platform               ", platform);
        console2.log("minPerAgentDeposit (wei)", minPer);
        console2.log("getRequestDeposit  (wei)", floor);
        console2.log("=> floor/min ratio (=subcommittee size)", floor / minPer);
    }
}
