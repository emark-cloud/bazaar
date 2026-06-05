// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {Arena} from "../../src/Arena.sol";
import {AgentRegistry} from "../../src/AgentRegistry.sol";
import {Treasury} from "../../src/Treasury.sol";
import {AuditCouncil} from "../../src/AuditCouncil.sol";
import {LeagueScheduler} from "../../src/LeagueScheduler.sol";

/// Resume the MAX_ROUNDS=20 redeploy after RedeployArenaLiveness aborted mid-broadcast (a bad
/// --gas-estimate-multiplier pushed tx3 over the block gas limit). The NEW Arena (NEW_ARENA env)
/// is already deployed and Registry.setOperator already succeeded; this finishes the remaining
/// wiring and deploys the new scheduler. Idempotent: re-running the setters is harmless.
contract FinishRedeploy is Script {
    bytes32 constant WINNER_DECLARED_TOPIC = keccak256("WinnerDeclared(uint256,uint256,int256)");

    function run() external {
        address registry_ = vm.envAddress("AGENT_REGISTRY");
        address treasury_ = vm.envAddress("TREASURY");
        address council_  = vm.envAddress("AUDIT_COUNCIL");
        address oldArena  = vm.envAddress("ARENA");        // old Arena, for matchId continuity
        address newArena  = vm.envAddress("NEW_ARENA");    // already-deployed Arena (MAX_ROUNDS=20)
        uint256 pk        = vm.envUint("PRIVATE_KEY");
        address deployer  = vm.addr(pk);

        uint256 resumeFrom = Arena(payable(oldArena)).nextMatchId();

        vm.startBroadcast(pk);

        // (Registry.setOperator already done in the prior run.) Treasury operator rights:
        Treasury(payable(treasury_)).setOperator(newArena, true);

        // Continue match numbering past everything escrowed in the shared Treasury.
        Arena(payable(newArena)).bumpMatchCounter(resumeFrom);

        // Two-way audit wiring (AuditCouncil reused; re-point it).
        Arena(payable(newArena)).setAuditCouncil(council_);
        AuditCouncil(payable(council_)).setArena(newArena);

        // New scheduler bound to the new Arena (immutable arena → must redeploy).
        LeagueScheduler sched = new LeagueScheduler(registry_, newArena, WINNER_DECLARED_TOPIC, deployer);
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

        console2.log("=== Finish redeploy (MAX_ROUNDS=20) ===");
        console2.log("NEW Arena (existing) ", newArena);
        console2.log("NEW Scheduler        ", address(sched));
        console2.log("nextMatchId set      ", resumeFrom);
    }
}
