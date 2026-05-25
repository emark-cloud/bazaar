// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice JSON API Request base agent. Signatures verified 2026-05-25.
/// `decimals` scales floats to integers by ×10^decimals (e.g. price 123.45 with decimals=2 → 12345).
interface IJsonApiAgent {
    function fetchString(string calldata url, string calldata selector)
        external returns (string memory);

    function fetchUint(string calldata url, string calldata selector, uint8 decimals)
        external returns (uint256);

    function fetchInt(string calldata url, string calldata selector, uint8 decimals)
        external returns (int256);
}
