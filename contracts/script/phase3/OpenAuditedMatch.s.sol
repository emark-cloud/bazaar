// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {Arena} from "../../src/Arena.sol";

/// Phase 3 demo: open one real-stakes match that flows through AuditCouncil.
/// Audit pipeline:
///   Arena._settle → council.beginAudit → Treasury.freezeMatch → VRF → verdicts + parse checks → finalize
contract OpenAuditedMatch is Script {
    function run() external {
        address arenaAddr = vm.envAddress("ARENA");
        uint256 pk = vm.envUint("PRIVATE_KEY");
        Arena arena = Arena(payable(arenaAddr));

        uint256 hawkId       = vm.envUint("HAWK_ID");
        uint256 diplomatId   = vm.envUint("DIPLOMAT_ID");
        uint256 quantId      = vm.envUint("QUANT_ID");
        uint256 contrarianId = vm.envUint("CONTRARIAN_ID");

        uint256[] memory ids = new uint256[](4);
        ids[0] = hawkId; ids[1] = diplomatId; ids[2] = quantId; ids[3] = contrarianId;

        // Two lots — ETH-USD and SOL-USD via Coinbase's public spot endpoint (same as Phase 2).
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

        // 25 STT × 4 agents = 100 STT pot. Plus 5 STT operating funds (stays in arena balance).
        uint256 entryStake = 25 ether;
        uint256 pot = entryStake * 4;
        uint256 op = 5 ether;

        vm.startBroadcast(pk);
        uint256 matchId = arena.openRealStakes{value: pot + op}(ids, entryStake, 2, lots);
        vm.stopBroadcast();

        console2.log("=== Phase 3 audited match opened ===");
        console2.log("matchId", matchId);
        console2.log("Arena  ", address(arena));
    }
}
