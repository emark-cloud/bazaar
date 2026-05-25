// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice LLM Parse Website base agent. Canonical signatures verified 2026-05-25 against
/// the Somnia Agent Explorer at agents.somnia.network/agent/12875401142070969085.
/// (The /agents docs page is missing the `confidenceThreshold` trailing param — the Explorer is the source of truth.)
interface IParseWebsiteAgent {
    function ExtractString(
        string memory key,
        string memory description,
        string[] calldata options,
        string memory prompt,
        string memory url,
        bool resolveUrl,
        uint8 numPages,
        uint8 confidenceThreshold
    ) external returns (string memory);

    function ExtractANumber(
        string memory key,
        string memory description,
        uint256 min,
        uint256 max,
        string memory prompt,
        string memory url,
        bool resolveUrl,
        uint8 numPages,
        uint8 confidenceThreshold
    ) external returns (uint256);
}
