// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {LeagueScheduler} from "../../src/LeagueScheduler.sol";
import {AgentRegistry} from "../../src/AgentRegistry.sol";
import {Arena} from "../../src/Arena.sol";

/// Phase 4 deploy: LeagueScheduler bound to Arena v3.
///
/// NOTE: this script uses --skip-simulation and is run via `forge create` style to avoid forge's
/// local EVM trying to call the Somnia reactivity precompile at 0x0100. The Arena/Registry wiring
/// and lot-template setup are done in this script, but the actual `start()` (which subscribes via
/// the precompile) is invoked separately via `cast send` after the contract holds ≥32 STT.
contract DeployPhase4 is Script {
    function run() external {
        address registry_ = vm.envAddress("AGENT_REGISTRY");
        address arena_    = vm.envAddress("ARENA");
        uint256 pk        = vm.envUint("PRIVATE_KEY");
        address deployer  = vm.addr(pk);

        bytes32 matchFinalizedTopic = keccak256("MatchFinalized(uint256,uint256[],int256[],uint256)");

        vm.startBroadcast(pk);
        LeagueScheduler sched = new LeagueScheduler(registry_, arena_, matchFinalizedTopic, deployer);

        // Two-lot ETH/SOL template — same Coinbase feeds Match #3 used.
        Arena.LotTemplate[] memory lots = new Arena.LotTemplate[](2);
        lots[0] = Arena.LotTemplate({
            category:     "ETH-USD",
            feedUrl:      "https://api.coinbase.com/v2/prices/ETH-USD/spot",
            feedSelector: "data.amount",
            feedDecimals: 0,
            valueDivisor: 1,
            valueHint:    "typically 1500-4000"
        });
        lots[1] = Arena.LotTemplate({
            category:     "SOL-USD",
            feedUrl:      "https://api.coinbase.com/v2/prices/SOL-USD/spot",
            feedSelector: "data.amount",
            feedDecimals: 0,
            valueDivisor: 1,
            valueHint:    "typically 50-200"
        });
        sched.setLotTemplates(lots);

        // Scheduler needs registry-operator rights to flip `joinable` flags via Arena
        // (Arena already operator on Registry; nothing extra needed here.)

        vm.stopBroadcast();

        console2.log("=== Phase 4 deployment ===");
        console2.log("LeagueScheduler", address(sched));
        console2.log("matchFinalizedTopic");
        console2.logBytes32(matchFinalizedTopic);
    }
}
