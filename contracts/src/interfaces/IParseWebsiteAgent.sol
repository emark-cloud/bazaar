// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice LLM Parse Website base agent. Signatures verified 2026-05-25 against
/// docs.somnia.network/agents/base-agents/llm-parse-website.
interface IParseWebsiteAgent {
    function ExtractString(
        string memory key,
        string memory description,
        string[] calldata options,
        string memory prompt,
        string memory url,
        bool resolveUrl,
        uint8 numPages
    ) external returns (string memory);

    function ExtractANumber(
        string memory key,
        string memory description,
        uint256 min,
        uint256 max,
        string memory prompt,
        string memory url,
        bool resolveUrl,
        uint8 numPages
    ) external returns (uint256);
}
