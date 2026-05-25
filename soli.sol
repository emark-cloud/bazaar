// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

enum ConsensusType { Majority, Threshold }
enum ResponseStatus {
    None,       // 0 - Default zero value (uninitialized storage)
    Pending,    // 1 - Awaiting responses
    Success,    // 2 - Consensus reached normally
    Failed,     // 3 - Validators reported failure
    TimedOut    // 4 - Request timed out
}

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

interface IAgentRequester {
    function createRequest(
        uint256 agentId,
        address callbackAddress,
        bytes4 callbackSelector,
        bytes calldata payload
    ) external payable returns (uint256 requestId);

    function getRequestDeposit() external view returns (uint256);
}

// Agent interface (for .selector and type safety)
interface IAgent {
    function ExtractString(string memory key, string memory description, string[] memory options, string memory prompt, string memory url, bool resolveUrl, uint8 numPages, uint8 confidenceThreshold) external returns (string memory);
}

contract MyContract {
    IAgentRequester public platform =
        IAgentRequester(0x5E5205CF39E766118C01636bED000A54D93163E6);

    uint256 constant AGENT_ID = 12875401142070969085;
    uint256 constant SUBCOMMITTEE_SIZE = 3; // matches the platform default
    uint256 constant PER_AGENT_EXECUTION_COST = 100000000000000000;

    // Store pending requests
    mapping(uint256 => address) public requestSenders;

    event AgentResponseReceived(uint256 indexed requestId, ResponseStatus status, string output);

    function invokeExtractString(string calldata key, string calldata description, string[] calldata options, string calldata prompt, string calldata url, bool resolveUrl, uint8 numPages, uint8 confidenceThreshold) external payable returns (uint256 requestId) {
        // 1. Encode the function call using the agent interface selector
        bytes memory payload = abi.encodeWithSelector(IAgent.ExtractString.selector, key, description, options, prompt, url, resolveUrl, numPages, confidenceThreshold);

        // 2. Safe deposit: contract floor + per-agent execution reward.
        //    Floor only would satisfy the contract but runners would skip
        //    the request because perAgentBudget < scheduledExecutionCost.
        uint256 reserve = platform.getRequestDeposit();
        uint256 reward = PER_AGENT_EXECUTION_COST * SUBCOMMITTEE_SIZE;
        uint256 deposit = reserve + reward;

        // 3. Send request with callback to this contract
        requestId = platform.createRequest{value: deposit}(
            AGENT_ID,
            address(this),
            this.handleResponse.selector,
            payload
        );
        requestSenders[requestId] = msg.sender;
    }

    // Called by the platform when consensus is reached
    // Signature matches IAgentRequesterHandler.handleResponse
    function handleResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory /* details */
    ) external {
        require(msg.sender == address(platform), "Only platform can call");

        if (status == ResponseStatus.Success && responses.length > 0) {
            // Decode the first successful response
            string memory output = abi.decode(responses[0].result, (string));
            emit AgentResponseReceived(requestId, status, output);
        } else {
            // Failed or timed out
            emit AgentResponseReceived(requestId, status, "");
        }
    }

    // Allow receiving rebates
    receive() external payable {}
}
