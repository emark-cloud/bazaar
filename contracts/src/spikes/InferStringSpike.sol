// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AgentPlatformBase} from "../lib/AgentPlatformBase.sol";
import {ILlmAgent} from "../interfaces/ILlmAgent.sol";
import {AgentIds} from "../lib/AgentIds.sol";
import {Request, Response, ResponseStatus, ConsensusType} from "../interfaces/IAgentPlatform.sol";

/// @notice Phase 0 spike #0.6 — confirm `inferString` with `allowedValues=["clean","suspect"]`
/// returns a constrained verdict, decoded under `Threshold` consensus (subcommittee 5 / threshold 3).
contract InferStringSpike is AgentPlatformBase {
    string public lastVerdict;
    uint256 public cleanCount;
    uint256 public suspectCount;
    ResponseStatus public lastStatus;

    event VerdictReceived(uint256 indexed requestId, uint256 cleanCount, uint256 suspectCount);

    constructor(address platform_) AgentPlatformBase(platform_) {}

    function requestVerdict(string calldata prompt, string calldata systemPrompt)
        external payable returns (uint256 requestId)
    {
        string[] memory allowed = new string[](2);
        allowed[0] = "clean";
        allowed[1] = "suspect";

        bytes memory payload = abi.encodeWithSelector(
            ILlmAgent.inferString.selector, prompt, systemPrompt, false, allowed
        );

        requestId = _sendAdvanced(
            AgentIds.LLM_INFERENCE,
            this.handleVerdict.selector,
            payload,
            AgentIds.PRICE_LLM,
            5,                     // subcommittee
            3,                     // threshold
            ConsensusType.Threshold,
            900,                   // 15 min timeout
            bytes32(uint256(3))
        );
    }

    function handleVerdict(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external onPlatformCallback(requestId) {
        lastStatus = status;
        uint256 cleans;
        uint256 suspects;
        for (uint256 i = 0; i < responses.length; i++) {
            if (responses[i].status != ResponseStatus.Success) continue;
            string memory v = abi.decode(responses[i].result, (string));
            bytes32 h = keccak256(bytes(v));
            if (h == keccak256("clean")) cleans++;
            else if (h == keccak256("suspect")) suspects++;
        }
        cleanCount = cleans;
        suspectCount = suspects;
        lastVerdict = cleans >= suspects ? "clean" : "suspect";
        emit VerdictReceived(requestId, cleans, suspects);
        emit RequestComplete(requestId, status);
    }
}
