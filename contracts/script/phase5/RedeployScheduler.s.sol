// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {Arena} from "../../src/Arena.sol";
import {LeagueScheduler} from "../../src/LeagueScheduler.sol";

/// Redeploy ONLY the LeagueScheduler against the current Arena, so the live instance is a clean
/// build of the committed source defaults (entryStake 0.25 / minBalanceThreshold 35) instead of a
/// post-deploy setter patch. The Arena (ARENA env) is unchanged. Follow-up (separate steps):
///   1) move the old scheduler's balance to the new one (withdraw),
///   2) apply off-chain addresses (config.ts / .env / subgraph.yaml),
///   3) fund + scheduler.start() only if auto-scheduling is wanted (reactivity precompile).
contract RedeployScheduler is Script {
    bytes32 constant WINNER_DECLARED_TOPIC = keccak256("WinnerDeclared(uint256,uint256,int256)");

    function run() external {
        address registry_ = vm.envAddress("AGENT_REGISTRY");
        address arena_    = vm.envAddress("ARENA");
        uint256 pk        = vm.envUint("PRIVATE_KEY");
        address deployer  = vm.addr(pk);

        vm.startBroadcast(pk);
        LeagueScheduler sched = new LeagueScheduler(registry_, arena_, WINNER_DECLARED_TOPIC, deployer);
        Arena.LotTemplate[] memory lots = new Arena.LotTemplate[](2);
        lots[0] = Arena.LotTemplate({
            category: "ETH-USD", feedUrl: "https://api.coinbase.com/v2/prices/ETH-USD/spot",
            feedSelector: "data.amount", feedDecimals: 0, valueDivisor: 1, valueHint: "typically 1500-4000"
        });
        lots[1] = Arena.LotTemplate({
            category: "SOL-USD", feedUrl: "https://api.coinbase.com/v2/prices/SOL-USD/spot",
            feedSelector: "data.amount", feedDecimals: 0, valueDivisor: 1, valueHint: "typically 50-200"
        });
        sched.setLotTemplates(lots);
        vm.stopBroadcast();

        console2.log("NEW Scheduler", address(sched));
        console2.log("Arena (unchanged)", arena_);
    }
}
