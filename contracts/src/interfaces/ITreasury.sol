// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Arena → Treasury interface. Operator-gated mutations; views are public.
interface ITreasury {
    /// @notice Lock in the pot for a real-stakes match. msg.value must equal entryStake × agentIds.length.
    /// Owners of the agents are recorded for payout routing.
    function escrowMatch(
        uint256 matchId,
        uint256[] calldata agentIds,
        address[] calldata agentOwners,
        uint256 entryStake
    ) external payable;

    /// @notice Settle the match: 5% rake to season fund, remainder distributed rank-weighted to ranked owners.
    /// `rankedAgentIds[0]` = winner, `rankedAgentIds[n-1]` = last. Forfeited agents come last.
    function settleMatch(uint256 matchId, uint256[] calldata rankedAgentIds) external;

    /// @notice Refund entry stakes to original owners (called when a match is voided).
    function refundMatch(uint256 matchId) external;

    /// @notice Block settleMatch until an appeal window passes; used by AuditCouncil on `suspect` quorum.
    function freezeMatch(uint256 matchId, uint256 appealUntilTimestamp) external;

    /// @notice Lift a freeze early (owner or AuditCouncil when audit clears).
    function unfreezeMatch(uint256 matchId) external;
}
