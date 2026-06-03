// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PromptLib — builds the system+user messages for a negotiation move.
/// @notice Extracted out of Arena as an EXTERNAL library (deployed separately,
/// linked, called via delegatecall) so the heavy string-building bytecode lives
/// here instead of pushing Arena over the EIP-170 limit. Pure/param-driven: it
/// reads nothing from storage, so the delegatecall context is irrelevant and the
/// prompt is trivially testable in isolation.
library PromptLib {
    /// Memory view of a lot, marshalled by Arena from its storage Lot.
    struct Lot {
        string  category;
        uint256 valueDivisor;
        string  valueHint;
        uint256 ownerAgentId;
        uint256 paidPrice;
        uint256 standingOfferPrice;
        uint256 standingOfferBy;
    }

    /// @param name        agent display name
    /// @param strategy    agent strategy prompt URI (its "DNA")
    /// @param matchId     match id (prompt context only)
    /// @param currentRound 1-based current round
    /// @param maxRounds   the safety cap (matches usually end earlier on a stall)
    /// @param agentId     the acting agent
    /// @param agentIds    all seated agents (parallel to budgets)
    /// @param budgets     each seated agent's remaining budget (public info)
    /// @param lots        per-lot memory views
    /// @param logWindow   recent moves, oldest→newest, already windowed by Arena
    function build(
        string memory name,
        string memory strategy,
        uint256 matchId,
        uint8   currentRound,
        uint8   maxRounds,
        uint256 agentId,
        uint256[] memory agentIds,
        uint256[] memory budgets,
        Lot[]   memory lots,
        string[] memory logWindow
    ) external pure returns (string[] memory roles, string[] memory messages) {
        roles = new string[](2);
        roles[0] = "system";
        roles[1] = "user";
        messages = new string[](2);
        messages[0] = string.concat(
            "You are agent \"", name, "\" in Bazaar - an on-chain auction where AI agents bid against each other.\n",
            "Strategy: ", strategy, "\n\n",
            "FORMAT (return EXACTLY one line, no prose, no markdown, no quotes):\n",
            "  OFFER|lot=<N>|side=BUY|price=<int>\n",
            "  COUNTER|lot=<N>|price=<int>\n",
            "  COALITION|partner=<int>|share=<int>\n",
            "  PASS\n\n",
            "RULES (will reject if violated):\n",
            "- price must be an INTEGER. No decimals, no commas, no underscores, no unit suffix.\n",
            "  OK: price=14    NOT OK: price=14_STT, price=14.5, price=1,400\n",
            "- price must be <= your remaining budget.\n",
            "- lot indices are 1-based.\n",
            "- COUNTER must beat the standing offer.\n\n",
            "GOAL: maximize your end-of-match score. Score = (lot true value / divisor) - paid price for each lot you own."
        );
        messages[1] = _renderState(matchId, currentRound, maxRounds, agentId, agentIds, budgets, lots, logWindow);
    }

    function _renderState(
        uint256 matchId,
        uint8   currentRound,
        uint8   maxRounds,
        uint256 agentId,
        uint256[] memory agentIds,
        uint256[] memory budgets,
        Lot[]   memory lots,
        string[] memory logWindow
    ) private pure returns (string memory) {
        uint256 budget;
        for (uint256 i = 0; i < agentIds.length; i++) {
            if (agentIds[i] == agentId) { budget = budgets[i]; break; }
        }
        bytes memory buf = abi.encodePacked(
            "Match ", _u(matchId), " | Round ", _u(currentRound), "/", _u(maxRounds), " (max)",
            " | You: agent=", _u(agentId), " budget=", _u(budget), "\n"
        );

        // All seated agents' budgets — public info, helps coalition/competition reasoning.
        buf = abi.encodePacked(buf, "Budgets:");
        for (uint256 i = 0; i < agentIds.length; i++) {
            buf = abi.encodePacked(buf, " agent", _u(agentIds[i]), "=", _u(budgets[i]));
        }
        buf = abi.encodePacked(buf, "\nLots (hint = expected effective value after divisor):\n");

        for (uint256 i = 0; i < lots.length; i++) {
            Lot memory L = lots[i];
            buf = abi.encodePacked(buf,
                "  ", _u(i + 1), ") ", L.category, " | divisor=", _u(L.valueDivisor),
                " | hint=", L.valueHint
            );
            if (L.ownerAgentId != 0) {
                buf = abi.encodePacked(buf, " | SOLD to agent ", _u(L.ownerAgentId), " at ", _u(L.paidPrice));
            } else if (L.standingOfferPrice > 0) {
                buf = abi.encodePacked(buf, " | standing offer ", _u(L.standingOfferPrice), " from agent ", _u(L.standingOfferBy));
            } else {
                buf = abi.encodePacked(buf, " | open");
            }
            buf = abi.encodePacked(buf, "\n");
        }

        if (logWindow.length > 0) {
            buf = abi.encodePacked(buf, "Log:\n");
            for (uint256 i = 0; i < logWindow.length; i++) {
                buf = abi.encodePacked(buf, "  ", logWindow[i], "\n");
            }
        }
        buf = abi.encodePacked(buf, "Your turn. Output one move line.");
        return string(buf);
    }

    function _u(uint256 v) private pure returns (string memory) {
        if (v == 0) return "0";
        uint256 j = v; uint256 len;
        while (j != 0) { len++; j /= 10; }
        bytes memory bs = new bytes(len);
        while (v != 0) { len--; bs[len] = bytes1(uint8(48 + v % 10)); v /= 10; }
        return string(bs);
    }
}
