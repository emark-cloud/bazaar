// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AgentPlatformBase} from "../lib/AgentPlatformBase.sol";
import {ILlmAgent} from "../interfaces/ILlmAgent.sol";
import {AgentIds} from "../lib/AgentIds.sol";
import {Request, Response, ResponseStatus} from "../interfaces/IAgentPlatform.sol";

/// @notice Phase 0 spike #0.7 — confirm `inferToolsChat` with an MCP server URL completes within
/// a single invocation (MCP tools execute automatically without a resume loop). Only on-chain tools
/// trigger the `finishReason == "tool_calls"` yield-and-resume pattern, which Bazaar does not use.
contract InferToolsChatSpike is AgentPlatformBase {
    string public lastFinishReason;
    string public lastResponse;
    ResponseStatus public lastStatus;

    event ToolsChatReceived(uint256 indexed requestId, string finishReason, string response);

    constructor(address platform_) AgentPlatformBase(platform_) {}

    function requestWithMcp(
        string calldata systemPrompt,
        string calldata userPrompt,
        string calldata mcpServerUrl
    ) external payable returns (uint256 requestId) {
        string[] memory roles = new string[](2);
        roles[0] = "system";
        roles[1] = "user";

        string[] memory messages = new string[](2);
        messages[0] = systemPrompt;
        messages[1] = userPrompt;

        string[] memory mcpUrls = new string[](1);
        mcpUrls[0] = mcpServerUrl;

        string[] memory onchainTools = new string[](0);

        bytes memory payload = abi.encodeWithSelector(
            ILlmAgent.inferToolsChat.selector,
            roles, messages, mcpUrls, onchainTools, uint256(3), false
        );

        requestId = _send(
            AgentIds.LLM_INFERENCE,
            this.handleToolsChat.selector,
            payload,
            AgentIds.PRICE_LLM,
            AgentIds.DEFAULT_SUBCOMMITTEE,
            bytes32(uint256(4))
        );
    }

    function handleToolsChat(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external onPlatformCallback(requestId) {
        lastStatus = status;
        if (_isSuccess(status, responses)) {
            (string memory finishReason, string memory response, , , , ) =
                abi.decode(responses[0].result, (string, string, string[], string[], string[], bytes[]));
            lastFinishReason = finishReason;
            lastResponse = response;
            emit ToolsChatReceived(requestId, finishReason, response);
        }
        emit RequestComplete(requestId, status);
    }
}
