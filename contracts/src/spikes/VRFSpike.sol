// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VRFConsumerBase} from "../lib/VRFConsumerBase.sol";

/// @title VRFSpike — Phase 0.9 verification of the Protofire VRF v2.5 wrapper on Somnia testnet.
/// @notice Sends one native-payment VRF request, captures the fulfilled random words on-chain.
contract VRFSpike is VRFConsumerBase {
    event VRFRequested(uint256 indexed requestId, uint256 price);
    event VRFFulfilled(uint256 indexed requestId, uint256[] randomWords);

    uint256 public lastRequestId;
    uint256[] public lastRandomWords;
    bool public fulfilled;

    /// @notice Tunable so spike can sweep different gas envelopes if the first attempt under-pays.
    uint32  public callbackGasLimit = 200_000;
    uint16  public requestConfirmations = 3;
    uint32  public numWords = 3;

    constructor(address vrfWrapper_) VRFConsumerBase(vrfWrapper_) {}

    function quote() external view returns (uint256) {
        return _vrfRequestPrice(callbackGasLimit, numWords);
    }

    function fire() external payable returns (uint256 requestId, uint256 price) {
        (requestId, price) = _requestRandomnessNative(callbackGasLimit, requestConfirmations, numWords);
        lastRequestId = requestId;
        emit VRFRequested(requestId, price);
    }

    function setGasLimit(uint32 cb) external { callbackGasLimit = cb; }
    function setNumWords(uint32 n) external { numWords = n; }

    function _fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        lastRandomWords = randomWords;
        fulfilled = true;
        emit VRFFulfilled(requestId, randomWords);
    }

    receive() external payable {}
}
