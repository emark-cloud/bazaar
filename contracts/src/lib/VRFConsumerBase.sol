// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IVRFV2PlusWrapper} from "../interfaces/IVRFV2PlusWrapper.sol";

/// @title VRFConsumerBase — minimal VRF v2.5 wrapper consumer (native payment).
/// @notice Equivalent to Chainlink's `VRFV2PlusWrapperConsumerBase` slimmed to the methods Bazaar uses.
/// Inherit and implement `_fulfillRandomWords`. The wrapper calls `rawFulfillRandomWords` (gated).
/// Native-payment flow: `_requestRandomnessNative()` computes price + sends value in one hop.
abstract contract VRFConsumerBase {
    IVRFV2PlusWrapper public immutable vrfWrapper;

    /// @dev VRF v2.5 ExtraArgsV1 tag = bytes4(keccak256("VRF ExtraArgsV1")).
    bytes4 internal constant EXTRA_ARGS_V1_TAG = 0x92fd1338;

    error OnlyVRFWrapper(address sender, address expected);
    error VRFUnderfunded(uint256 balance, uint256 required);

    constructor(address vrfWrapper_) {
        vrfWrapper = IVRFV2PlusWrapper(vrfWrapper_);
    }

    /// @dev Build the V2.5 ExtraArgsV1 calldata for native-payment requests.
    function _extraArgsNative() internal pure returns (bytes memory) {
        // abi.encodeWithSelector(EXTRA_ARGS_V1_TAG, ExtraArgsV1({ nativePayment: true }))
        return abi.encodeWithSelector(EXTRA_ARGS_V1_TAG, true);
    }

    /// @dev Quote the price (in native wei) of a VRF request with given params.
    function _vrfRequestPrice(uint32 callbackGasLimit, uint32 numWords)
        internal view returns (uint256)
    {
        return vrfWrapper.calculateRequestPriceNative(callbackGasLimit, numWords);
    }

    /// @dev Fire a VRF request, paying in native STT from this contract's balance.
    function _requestRandomnessNative(
        uint32 callbackGasLimit,
        uint16 requestConfirmations,
        uint32 numWords
    ) internal returns (uint256 requestId, uint256 price) {
        price = vrfWrapper.calculateRequestPriceNative(callbackGasLimit, numWords);
        if (address(this).balance < price) revert VRFUnderfunded(address(this).balance, price);
        requestId = vrfWrapper.requestRandomWordsInNative{value: price}(
            callbackGasLimit, requestConfirmations, numWords, _extraArgsNative()
        );
    }

    /// @notice Called by the wrapper on fulfillment. Forwards to the implementer's override.
    function rawFulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external {
        if (msg.sender != address(vrfWrapper)) revert OnlyVRFWrapper(msg.sender, address(vrfWrapper));
        _fulfillRandomWords(requestId, randomWords);
    }

    function _fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal virtual;
}
