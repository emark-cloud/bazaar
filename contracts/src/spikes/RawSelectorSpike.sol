// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AgentPlatformBase} from "../lib/AgentPlatformBase.sol";
import {AgentIds} from "../lib/AgentIds.sol";
import {Request, Response, ResponseStatus} from "../interfaces/IAgentPlatform.sol";

/// @notice Phase 0 — probe the canonical `inferToolsChat` selector by trying a few struct shapes.
/// We don't know the underlying `OnchainTool` struct fields, so we can't encode a non-empty array.
/// But the Solidity ABI's encoding of an *empty* array is identical regardless of element type
/// (just `length=0`), so we can vary the SELECTOR while keeping the rest of the payload identical
/// and look for the one that passes validation (non-400 response).
contract RawSelectorSpike is AgentPlatformBase {
    uint8 public lastStatus;
    bytes4 public lastSelector;
    uint256 public lastRequestId;

    event Probe(uint256 indexed requestId, bytes4 selector);
    event Result(uint256 indexed requestId, uint8 status);

    constructor(address platform_) AgentPlatformBase(platform_) {}

    /// @notice Fire an inferToolsChat call with caller-provided selector and pre-encoded args.
    /// args must be the ABI-encoded tail (everything AFTER the selector) for:
    ///   (string[] roles, string[] messages, string[] mcpServerUrls, T[] onchainTools, uint256 maxIterations, bool chainOfThought)
    /// where T is whatever struct the agent expects. With onchainTools=[] empty, T's shape doesn't affect encoding.
    function fireRaw(bytes4 selector, bytes calldata args) external payable returns (uint256 requestId) {
        bytes memory payload = bytes.concat(abi.encodePacked(selector), args);
        requestId = _send(
            AgentIds.LLM_INFERENCE,
            this.handleAny.selector,
            payload,
            AgentIds.PRICE_LLM,
            AgentIds.DEFAULT_SUBCOMMITTEE,
            bytes32(uint256(uint32(uint256(uint32(selector)))))
        );
        lastSelector = selector;
        lastRequestId = requestId;
        emit Probe(requestId, selector);
    }

    function handleAny(
        uint256 requestId,
        Response[] memory /* responses */,
        ResponseStatus status,
        Request memory
    ) external onPlatformCallback(requestId) {
        lastStatus = uint8(status);
        emit Result(requestId, uint8(status));
    }
}
