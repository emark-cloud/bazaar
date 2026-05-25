// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AgentPlatformBase} from "../lib/AgentPlatformBase.sol";
import {IParseWebsiteAgent} from "../interfaces/IParseWebsiteAgent.sol";
import {AgentIds} from "../lib/AgentIds.sol";
import {Request, Response, ResponseStatus} from "../interfaces/IAgentPlatform.sol";

/// @notice Phase 0 sub-spike — confirm LLM Parse Website's `ExtractANumber` returns a usable
/// value for the audit-council cross-check pattern.
contract ParseWebsiteSpike is AgentPlatformBase {
    uint256 public lastNumber;
    ResponseStatus public lastStatus;

    event NumberExtracted(uint256 indexed requestId, uint256 value);

    constructor(address platform_) AgentPlatformBase(platform_) {}

    function requestNumber(
        string calldata key,
        string calldata description,
        uint256 min,
        uint256 max,
        string calldata prompt,
        string calldata url
    ) external payable returns (uint256 requestId) {
        bytes memory payload = abi.encodeWithSelector(
            IParseWebsiteAgent.ExtractANumber.selector,
            key, description, min, max, prompt, url, false, uint8(1)
        );
        requestId = _send(
            AgentIds.LLM_PARSE_WEBSITE,
            this.handleNumber.selector,
            payload,
            AgentIds.PRICE_PARSE_WEBSITE,
            AgentIds.DEFAULT_SUBCOMMITTEE,
            bytes32(uint256(5))
        );
    }

    function handleNumber(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external onPlatformCallback(requestId) {
        lastStatus = status;
        if (_isSuccess(status, responses)) {
            lastNumber = abi.decode(responses[0].result, (uint256));
            emit NumberExtracted(requestId, lastNumber);
        }
        emit RequestComplete(requestId, status);
    }
}
