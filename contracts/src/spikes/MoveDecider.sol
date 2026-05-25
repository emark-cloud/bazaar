// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AgentPlatformBase} from "../lib/AgentPlatformBase.sol";
import {ILlmAgent} from "../interfaces/ILlmAgent.sol";
import {AgentIds} from "../lib/AgentIds.sol";
import {Request, Response, ResponseStatus} from "../interfaces/IAgentPlatform.sol";

/// @notice Phase 0 spike #0.4 — confirm `inferChat` returns a deterministic move string
/// under `Majority` consensus for a realistic negotiation prompt. Mirrors spec §5.
///
/// What we check on success:
///   - Status: Success
///   - responses.length >= threshold (2)
///   - All responses[i].result decode to identical strings (Majority byte-equality)
///   - The string is a parseable move (e.g. "OFFER|lot=2|side=BUY|price=12")
///
/// On failure, see docs/TECHNICAL.md for the recorded fallback decision (Threshold + canonical selector).
contract MoveDecider is AgentPlatformBase {
    string public lastMove;
    ResponseStatus public lastStatus;
    uint256 public lastResponseCount;
    bool public lastByteIdentical;

    event MoveReceived(uint256 indexed requestId, string move, uint256 responseCount, bool byteIdentical);

    constructor(address platform_) AgentPlatformBase(platform_) {}

    function requestMove(string calldata personaAndRules, string calldata arenaState)
        external payable returns (uint256 requestId)
    {
        string[] memory roles = new string[](2);
        roles[0] = "system";
        roles[1] = "user";

        string[] memory messages = new string[](2);
        messages[0] = personaAndRules;
        messages[1] = arenaState;

        bytes memory payload = abi.encodeWithSelector(
            ILlmAgent.inferChat.selector, roles, messages, false
        );

        requestId = _send(
            AgentIds.LLM_INFERENCE,
            this.handleMove.selector,
            payload,
            AgentIds.PRICE_LLM,
            AgentIds.DEFAULT_SUBCOMMITTEE,
            bytes32(uint256(1))
        );
    }

    function handleMove(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory /* details */
    ) external onPlatformCallback(requestId) {
        lastStatus = status;
        lastResponseCount = responses.length;

        if (!_isSuccess(status, responses)) {
            emit MoveReceived(requestId, "", responses.length, false);
            emit RequestComplete(requestId, status);
            return;
        }

        string memory firstMove = abi.decode(responses[0].result, (string));
        bool allEqual = true;
        bytes32 firstHash = keccak256(bytes(firstMove));
        for (uint256 i = 1; i < responses.length; i++) {
            if (keccak256(responses[i].result) == bytes32(0)) { allEqual = false; break; }
            string memory m = abi.decode(responses[i].result, (string));
            if (keccak256(bytes(m)) != firstHash) { allEqual = false; break; }
        }

        lastMove = firstMove;
        lastByteIdentical = allEqual;
        emit MoveReceived(requestId, firstMove, responses.length, allEqual);
        emit RequestComplete(requestId, status);
    }
}
