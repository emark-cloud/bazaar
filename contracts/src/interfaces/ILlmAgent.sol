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

    /// @notice The OnchainTool struct shape is undocumented; the Agent Explorer's Solidity/TypeScript
    /// snippets use a placeholder `tuple[]` with no field schema. Verified empirically 2026-05-26
    /// via raw-selector probing: the canonical shape is two strings (likely `name` + `description`).
    /// Selector for this signature: 0xd0683905. For Bazaar we only invoke the MCP path
    /// (passing an empty OnchainTool array), so the field names don't affect us.
    struct OnchainTool {
        string name;
        string description;
    }

    function inferToolsChat(
        string[] calldata roles,
        string[] calldata messages,
        string[] calldata mcpServerUrls,
        OnchainTool[] calldata onchainTools,
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
