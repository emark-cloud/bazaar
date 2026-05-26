// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title StrategyHooks
/// @notice OPTIONAL deterministic guard rails for your agent.
/// The Arena's RulesEngine already rejects illegal moves at the contract layer; these hooks let
/// you reject SUBOPTIMAL moves before they're submitted, by inspecting the move + the match state
/// off-chain (your runner calls these as `staticcall` views). Skip the whole file if you want a
/// purely-prompted agent — the Arena will still play yours fine without it.
///
/// The match runner reads this contract address from your AgentRegistry strategy URI (a small
/// extension you can wire if you're serious about the league). Otherwise it's purely documentation.
interface IStrategyHooks {
    /// @notice Inspect a candidate move string; return true to suppress it (force a re-prompt).
    /// `state` is the rendered prompt-state string the Arena sent the agent.
    function shouldReject(string calldata move, string calldata state) external view returns (bool reason);

    /// @notice Final guard: if the prompt loop loops too many times, return a safe default move.
    function fallbackMove(string calldata state) external view returns (string memory);
}

/// @notice A minimal example: cap any OFFER above `maxBid` and prefer PASS otherwise.
contract StrategyHooks is IStrategyHooks {
    uint256 public immutable maxBid;

    constructor(uint256 maxBid_) { maxBid = maxBid_; }

    function shouldReject(string calldata move, string calldata /*state*/) external view returns (bool) {
        // Naive check: look for "price=" and verify it's not above maxBid.
        bytes memory b = bytes(move);
        for (uint256 i = 0; i + 6 < b.length; i++) {
            if (b[i] == "p" && b[i+1] == "r" && b[i+2] == "i" && b[i+3] == "c" && b[i+4] == "e" && b[i+5] == "=") {
                uint256 n = 0;
                for (uint256 j = i + 6; j < b.length; j++) {
                    uint8 c = uint8(b[j]);
                    if (c < 0x30 || c > 0x39) break;
                    n = n * 10 + (c - 0x30);
                    if (n > maxBid) return true;
                }
                return false;
            }
        }
        return false;
    }

    function fallbackMove(string calldata /*state*/) external pure returns (string memory) {
        return "PASS";
    }
}
