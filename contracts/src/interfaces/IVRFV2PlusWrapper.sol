// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal Chainlink VRF v2.5 wrapper interface — the only methods we need.
/// Protofire's Somnia deployment (testnet 0x763cC914d5CA79B04dC4787aC14CcAd780a16BD2,
/// mainnet 0x606b2B36516AB7479D1445Ec14B6B39B44901bf8) is a standard VRFV2PlusWrapper.
interface IVRFV2PlusWrapper {
    /// @notice Price (in native, wei) for a request with the given callback gas + word count.
    function calculateRequestPriceNative(uint32 callbackGasLimit, uint32 numWords)
        external view returns (uint256);

    /// @notice Pay-in-native request. `extraArgs` must be the VRF v2.5 ExtraArgsV1 encoding with
    /// `nativePayment=true`. Returns the VRF request id used in the fulfillment callback.
    function requestRandomWordsInNative(
        uint32 callbackGasLimit,
        uint16 requestConfirmations,
        uint32 numWords,
        bytes calldata extraArgs
    ) external payable returns (uint256 requestId);

    function lastRequestId() external view returns (uint256);
}
