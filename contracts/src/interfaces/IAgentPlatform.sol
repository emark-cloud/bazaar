// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Somnia Agents platform structs and interface, verified 2026-05-25 against
/// docs.somnia.network/agents/invoking-agents/from-solidity.
/// Do not modify field order or names — the platform encodes/decodes against these.

enum ConsensusType { Majority, Threshold }
enum ResponseStatus { None, Pending, Success, Failed, TimedOut }

struct Response {
    address validator;
    bytes result;
    ResponseStatus status;
    uint256 receipt;
    uint256 timestamp;
    uint256 executionCost;
}

struct Request {
    uint256 id;
    address requester;
    address callbackAddress;
    bytes4 callbackSelector;
    address[] subcommittee;
    Response[] responses;
    uint256 responseCount;
    uint256 failureCount;
    uint256 threshold;
    uint256 createdAt;
    uint256 deadline;
    ResponseStatus status;
    ConsensusType consensusType;
    uint256 remainingBudget;
    uint256 perAgentBudget;
}

interface IAgentPlatform {
    function createRequest(
        uint256 agentId,
        address callbackAddress,
        bytes4 callbackSelector,
        bytes calldata payload
    ) external payable returns (uint256 requestId);

    function createAdvancedRequest(
        uint256 agentId,
        address callbackAddress,
        bytes4 callbackSelector,
        bytes calldata payload,
        uint256 subcommitteeSize,
        uint256 threshold,
        ConsensusType consensusType,
        uint256 timeout
    ) external payable returns (uint256 requestId);

    function getRequestDeposit() external view returns (uint256);

    function getAdvancedRequestDeposit(uint256 subcommitteeSize) external view returns (uint256);

    function minPerAgentDeposit() external view returns (uint256);

    /// @notice Read the full Request struct (including all `responses[]` and their `result` bytes)
    /// for a finalized request. Useful for on-chain diagnostics; the canonical receipts service
    /// is a fully client-rendered UI, so this is the only programmatic path to validator results.
    function getRequest(uint256 requestId) external view returns (Request memory);
}
