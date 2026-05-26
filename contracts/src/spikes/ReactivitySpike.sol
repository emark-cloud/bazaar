// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {SomniaEventHandler} from "@somnia-chain/reactivity-contracts/contracts/SomniaEventHandler.sol";
import {SomniaExtensions} from "@somnia-chain/reactivity-contracts/contracts/interfaces/SomniaExtensions.sol";

/// @title ReactivitySpike — Phase 0.8 verification of Somnia on-chain reactivity.
/// @notice Subscribes to its own `Ping(uint256)` event with explicit emitter+topic filter.
///         Every time `ping(value)` is called, the precompile fires a reactive callback into
///         `_onEvent` which increments `tickCount` and records the event data.
///
/// The spike is the cheapest way to:
///   1. Confirm the 32-STT subscription owner balance enforcement,
///   2. Measure per-callback gas + native fee,
///   3. Verify the eventTopics/emitter filter actually receives matching logs,
///   4. Sanity-check that `tx.origin == this` and `msg.sender == 0x0100` inside the callback.
contract ReactivitySpike is SomniaEventHandler {
    address public immutable owner;
    uint256 public subscriptionId;

    uint256 public tickCount;
    uint256 public lastPingValue;
    bytes32 public lastEventTopic0;
    address public lastEmitter;
    address public lastTxOrigin;
    address public lastMsgSender;

    event Ping(uint256 indexed value);
    event Tick(uint256 value, uint256 tickCount);
    event SubscriptionEstablished(uint256 subscriptionId);

    constructor() payable {
        owner = msg.sender;
    }

    /// @notice Subscribes to our own `Ping(uint256)` event. Caller MUST send ≥32 STT in the deploy
    /// tx or via `receive()` before invocation, since the precompile enforces a 32-STT balance gate.
    function subscribeSelf() external returns (uint256 subId) {
        require(msg.sender == owner, "not owner");
        require(subscriptionId == 0, "already subscribed");

        SomniaExtensions.SubscriptionFilter memory filter = SomniaExtensions.SubscriptionFilter({
            eventTopics: [
                bytes32(keccak256("Ping(uint256)")),
                bytes32(0),
                bytes32(0),
                bytes32(0)
            ],
            origin: address(0),
            emitter: address(this)
        });
        SomniaExtensions.SubscriptionOptions memory opts = SomniaExtensions.SubscriptionOptions({
            priorityFeePerGas: 0,
            maxFeePerGas: 20 gwei,
            gasLimit: 500_000
        });
        subId = SomniaExtensions.subscribe(address(this), filter, opts);
        subscriptionId = subId;
        emit SubscriptionEstablished(subId);
    }

    /// @notice Emit a Ping. The reactivity precompile will fan out a callback into `_onEvent`
    /// in the next reactive transaction.
    function ping(uint256 value) external {
        emit Ping(value);
    }

    function unsubscribe() external {
        require(msg.sender == owner, "not owner");
        require(subscriptionId != 0, "no sub");
        SomniaExtensions.unsubscribe(subscriptionId);
        subscriptionId = 0;
    }

    function _onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata /*data*/
    ) internal override {
        tickCount += 1;
        lastEmitter = emitter;
        lastEventTopic0 = eventTopics.length > 0 ? eventTopics[0] : bytes32(0);
        // Ping(uint256) is indexed — value comes in as eventTopics[1]
        uint256 value = eventTopics.length > 1 ? uint256(eventTopics[1]) : 0;
        lastPingValue = value;
        lastTxOrigin = tx.origin;
        lastMsgSender = msg.sender;
        emit Tick(value, tickCount);
    }

    receive() external payable {}
}
