// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice LLM Inference base agent. Signatures verified 2026-05-25.
/// Deterministic output across validators → `Majority` consensus works for `inferChat`/`inferString`/`inferNumber`.
/// `inferToolsChat` may need the yield-and-resume loop when `finishReason == "tool_calls"` and the call references on-chain tools.
interface ILlmAgent {
    function inferChat(
        string[] calldata roles,
        string[] calldata messages,
        bool chainOfThought
    ) external returns (string memory response);

    function inferString(
        string calldata prompt,
        string calldata systemPrompt,
        bool chainOfThought,
        string[] calldata allowedValues
    ) external returns (string memory response);

    function inferNumber(
        string calldata prompt,
        string calldata systemPrompt,
        bool chainOfThought,
        uint256 min,
        uint256 max
    ) external returns (uint256 response);

    function inferToolsChat(
        string[] calldata roles,
        string[] calldata messages,
        string[] calldata mcpServerUrls,
        string[] calldata onchainTools,
        uint256 maxIterations,
        bool chainOfThought
    ) external returns (
        string memory finishReason,
        string memory response,
        string[] memory updatedRoles,
        string[] memory updatedMessages,
        string[] memory pendingToolCallIds,
        bytes[] memory pendingToolCalls
    );
}
