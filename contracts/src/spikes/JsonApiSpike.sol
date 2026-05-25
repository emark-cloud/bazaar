// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AgentPlatformBase} from "../lib/AgentPlatformBase.sol";
import {IJsonApiAgent} from "../interfaces/IJsonApiAgent.sol";
import {AgentIds} from "../lib/AgentIds.sol";
import {Request, Response, ResponseStatus} from "../interfaces/IAgentPlatform.sol";

/// @notice Phase 0 spike #0.5 — confirm JSON API `fetchUint` works and deposit math is right.
/// Uses the same Coinbase SOL-USD feed observed in production traffic on testnet.
contract JsonApiSpike is AgentPlatformBase {
    uint256 public lastPrice;
    ResponseStatus public lastStatus;

    event PriceReceived(uint256 indexed requestId, uint256 priceScaled, ResponseStatus status);

    constructor(address platform_) AgentPlatformBase(platform_) {}

    function requestPrice(string calldata url, string calldata selector, uint8 decimals)
        external payable returns (uint256 requestId)
    {
        bytes memory payload = abi.encodeWithSelector(
            IJsonApiAgent.fetchUint.selector, url, selector, decimals
        );
        requestId = _send(
            AgentIds.JSON_API_REQUEST,
            this.handlePrice.selector,
            payload,
            AgentIds.PRICE_JSON_API,
            AgentIds.DEFAULT_SUBCOMMITTEE,
            bytes32(uint256(2))
        );
    }

    function handlePrice(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external onPlatformCallback(requestId) {
        lastStatus = status;
        if (_isSuccess(status, responses)) {
            lastPrice = abi.decode(responses[0].result, (uint256));
        }
        emit PriceReceived(requestId, lastPrice, status);
        emit RequestComplete(requestId, status);
    }
}
