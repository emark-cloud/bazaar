// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Somnia base-agent IDs (testnet)
/// @notice Source: https://agents.testnet.somnia.network (read 2026-05-25).
///         LLM Parse Website ID is also documented at
///         docs.somnia.network/agents/base-agents/llm-parse-website.
///         The docs hard-code only Parse Website; the others come from the live Agent Explorer.
library AgentIds {
    uint256 internal constant LLM_INFERENCE       = 12847293847561029384;
    uint256 internal constant JSON_API_REQUEST    = 13174292974160097713;
    uint256 internal constant LLM_PARSE_WEBSITE   = 12875401142070969085;

    // Per-agent prices in wei (1 STT = 1e18). Spec §2.2 / Resources §4.2.
    uint256 internal constant PRICE_LLM           = 0.07 ether;
    uint256 internal constant PRICE_JSON_API      = 0.03 ether;
    uint256 internal constant PRICE_PARSE_WEBSITE = 0.10 ether;

    uint256 internal constant DEFAULT_SUBCOMMITTEE = 3;
    uint256 internal constant DEFAULT_THRESHOLD    = 2;
}
