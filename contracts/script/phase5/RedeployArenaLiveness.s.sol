// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {Arena} from "../../src/Arena.sol";
import {AgentRegistry} from "../../src/AgentRegistry.sol";
import {Treasury} from "../../src/Treasury.sol";
import {AuditCouncil} from "../../src/AuditCouncil.sol";
import {LeagueScheduler} from "../../src/LeagueScheduler.sol";

/// Phase 5: redeploy Arena with the liveness patch (reapStalled + affordability precheck) and
/// rewire the shared infra to it. Deploys a new Arena AND a new LeagueScheduler (the scheduler's
/// `arena` is immutable, so it can't be re-pointed). AuditCouncil/Registry/Treasury are reused.
///
/// IMPORTANT: this script intentionally does NOT call scheduler.start() or oldScheduler.stop() —
/// both hit the Somnia reactivity precompile (0x0100), which a local fork can't execute. Run those
/// two as separate `cast send` steps AFTER the new scheduler holds >=32 STT. See open-match.sh
/// sibling notes / the runbook for exact commands.
///
/// Continuity: matchIds are escrow keys in the SHARED Treasury, so the new Arena's counter is bumped
/// to the old Arena's `nextMatchId` to avoid colliding with already-escrowed real-stakes matches.
contract RedeployArenaLiveness is Script {
    // The live scheduler subscribes to Arena's WinnerDeclared event (verified on-chain:
    // topic 0xeff67fbe...). The repo's phase4 script hardcodes the wrong MatchFinalized name — do
    // NOT copy that. WinnerDeclared(uint256 indexed,uint256 indexed,int256).
    bytes32 constant WINNER_DECLARED_TOPIC = keccak256("WinnerDeclared(uint256,uint256,int256)");

    function run() external {
        address platform  = vm.envAddress("PLATFORM_TESTNET");
        address registry_ = vm.envAddress("AGENT_REGISTRY");
        address treasury_ = vm.envAddress("TREASURY");
        address council_  = vm.envAddress("AUDIT_COUNCIL");
        address oldArena  = vm.envAddress("ARENA");
        uint256 pk        = vm.envUint("PRIVATE_KEY");
        address deployer  = vm.addr(pk);

        uint256 resumeFrom = Arena(payable(oldArena)).nextMatchId(); // continue match numbering

        vm.startBroadcast(pk);

        // 1. New Arena (liveness patch) on the same Registry + Treasury.
        Arena arena = new Arena(platform, registry_, treasury_, deployer);

        // 2. Operator rights for the new Arena (old Arena left as-is — harmless).
        AgentRegistry(registry_).setOperator(address(arena), true);
        Treasury(payable(treasury_)).setOperator(address(arena), true);

        // 3. Continue match numbering past everything escrowed in the shared Treasury.
        arena.bumpMatchCounter(resumeFrom);

        // 4. Two-way audit wiring (AuditCouncil is reused; just re-point it).
        arena.setAuditCouncil(council_);
        AuditCouncil(payable(council_)).setArena(address(arena));

        // 5. New scheduler bound to the new Arena (immutable arena → must redeploy).
        LeagueScheduler sched = new LeagueScheduler(registry_, address(arena), WINNER_DECLARED_TOPIC, deployer);
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

        console2.log("=== Phase 5: Arena liveness redeploy ===");
        console2.log("NEW Arena        ", address(arena));
        console2.log("NEW Scheduler    ", address(sched));
        console2.log("nextMatchId set  ", resumeFrom);
        console2.log("AuditCouncil     ", council_, "(reused, re-pointed)");
        console2.log("--- follow-up (separate cast send, precompile) ---");
        console2.log("1) fund NEW scheduler >=120 STT (54 min gate at op=21; rest = match headroom),");
        console2.log("   then scheduler.start()");
        console2.log("2) oldScheduler.stop() to release its subscription");
        console2.log("3) apply off-chain addresses: ./script/apply-new-addresses.sh <arena> <sched>");
    }
}
