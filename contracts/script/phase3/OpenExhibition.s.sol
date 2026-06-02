// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {Arena} from "../../src/Arena.sol";

/// Open one exhibition match (no pot, no audit gating) so the live board can be
/// observed end-to-end: pricing → autonomous negotiation → settlement. Operating
/// funds for the platform calls come from the Arena's own balance (+ the small
/// msg.value sent here as headroom). Same four house agents and lots as the
/// real-stakes demo.
contract OpenExhibition is Script {
    function run() external {
        address arenaAddr = vm.envAddress("ARENA");
        uint256 pk = vm.envUint("PRIVATE_KEY");
        Arena arena = Arena(payable(arenaAddr));

        uint256[] memory ids = new uint256[](4);
        ids[0] = vm.envUint("HAWK_ID");
        ids[1] = vm.envUint("DIPLOMAT_ID");
        ids[2] = vm.envUint("QUANT_ID");
        ids[3] = vm.envUint("CONTRARIAN_ID");

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

        uint256 startingBudget = 25 ether; // displays as "25 STT" per agent
        uint8 rounds = 2;

        vm.startBroadcast(pk);
        // 5 STT headroom on top of the Arena's existing operating balance.
        uint256 matchId = arena.openExhibition{value: 5 ether}(ids, startingBudget, rounds, lots);
        vm.stopBroadcast();

        console2.log("=== exhibition match opened ===");
        console2.log("matchId", matchId);
        console2.log("Arena  ", address(arena));
    }
}
