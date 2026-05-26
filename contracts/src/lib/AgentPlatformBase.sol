// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IAgentPlatform, Request, Response, ResponseStatus, ConsensusType} from "../interfaces/IAgentPlatform.sol";

/// @title AgentPlatformBase
/// @notice Shared base for every Bazaar contract that calls the Somnia agent platform.
///         Encodes the four non-negotiable integration rules:
///         1. Deposit math: msg.value = floor + perAgentPrice × subcommitteeSize.
///         2. `receive()` is implemented (rebate target).
///         3. Every callback is gated by `msg.sender == platform` AND a `pendingRequests` mapping.
///         4. Decoding `responses[0].result` is guarded by status + length checks.
///
/// Inherit, then implement a callback that uses the `onPlatformCallback` modifier and
/// `_isSuccess(status, responses)` helper before decoding.
abstract contract AgentPlatformBase {
    IAgentPlatform public immutable platform;

    /// requestId → context for the in-flight request (encoded by the inheriting contract).
    mapping(uint256 => bytes32) internal pendingRequests;

    event RequestSent(uint256 indexed requestId, uint256 indexed agentId, uint256 deposit);
    event RequestComplete(uint256 indexed requestId, ResponseStatus status);

    error NotPlatform(address sender);
    error UnknownRequest(uint256 requestId);
    error Underfunded(uint256 sent, uint256 required);

    constructor(address platform_) {
        platform = IAgentPlatform(platform_);
    }

    modifier onlyPlatform() {
        if (msg.sender != address(platform)) revert NotPlatform(msg.sender);
        _;
    }

    modifier onPlatformCallback(uint256 requestId) {
        if (msg.sender != address(platform)) revert NotPlatform(msg.sender);
        if (pendingRequests[requestId] == bytes32(0)) revert UnknownRequest(requestId);
        _;
        delete pendingRequests[requestId];
    }

    /// @dev Compute deposit for a standard `createRequest` (default subcommittee).
    function _depositFor(uint256 perAgentPrice, uint256 subcommitteeSize)
        internal view returns (uint256)
    {
        return platform.getRequestDeposit() + (perAgentPrice * subcommitteeSize);
    }

    /// @dev Compute deposit for `createAdvancedRequest` at a custom subcommittee size.
    function _advancedDepositFor(uint256 perAgentPrice, uint256 subcommitteeSize)
        internal view returns (uint256)
    {
        return platform.getAdvancedRequestDeposit(subcommitteeSize)
            + (perAgentPrice * subcommitteeSize);
    }

    /// @dev Send a standard request. Draws from the contract's balance so internal callbacks
    /// (which arrive with msg.value=0) can fan out further requests against a pre-funded balance.
    /// External payable callers top up `address(this).balance` via `msg.value` before _send runs.
    function _send(
        uint256 agentId,
        bytes4 callbackSelector,
        bytes memory payload,
        uint256 perAgentPrice,
        uint256 subcommitteeSize,
        bytes32 context
    ) internal returns (uint256 requestId) {
        uint256 deposit = _depositFor(perAgentPrice, subcommitteeSize);
        if (address(this).balance < deposit) revert Underfunded(address(this).balance, deposit);

        requestId = platform.createRequest{value: deposit}(
            agentId, address(this), callbackSelector, payload
        );
        pendingRequests[requestId] = context;
        emit RequestSent(requestId, agentId, deposit);
    }

    /// @dev Send an advanced request. Same balance-based gating as `_send`.
    function _sendAdvanced(
        uint256 agentId,
        bytes4 callbackSelector,
        bytes memory payload,
        uint256 perAgentPrice,
        uint256 subcommitteeSize,
        uint256 threshold,
        ConsensusType consensusType,
        uint256 timeout,
        bytes32 context
    ) internal returns (uint256 requestId) {
        uint256 deposit = _advancedDepositFor(perAgentPrice, subcommitteeSize);
        if (address(this).balance < deposit) revert Underfunded(address(this).balance, deposit);

        requestId = platform.createAdvancedRequest{value: deposit}(
            agentId, address(this), callbackSelector, payload,
            subcommitteeSize, threshold, consensusType, timeout
        );
        pendingRequests[requestId] = context;
        emit RequestSent(requestId, agentId, deposit);
    }

    /// @dev Rule 4: never decode a response without checking status + length first.
    function _isSuccess(ResponseStatus status, Response[] memory responses)
        internal pure returns (bool)
    {
        return status == ResponseStatus.Success && responses.length > 0;
    }

    /// @dev Rule 2: rebates land here on finalization. NEVER remove this.
    receive() external payable {}
}
