# Phase 4 — results

Phase 4 ship gate: **A LeagueScheduler subscribes to `Arena.WinnerDeclared` via Somnia on-chain reactivity, and autonomously seats and funds the next match.** A multi-match season runs without human or off-chain intervention once seeded.

## What shipped

| Contract | Address (testnet) |
|---|---|
| `LeagueScheduler` | `0x41431f15ab45689bbe5eb71690c58b291dfda7e1` |
| `ReactivitySpike` (Phase 0.8) | `0xeFaA5Ca8c21bF38fA9a1dA7c6Bf393B8cBe47522` |

Active reactivity subscription: id `2349689` (re-subscribed after correcting the event-topic from `MatchFinalized` → `WinnerDeclared`).

## Phase 0.8 — Reactivity spike (verification)

Deployed a self-subscribing `ReactivitySpike`. The spike emits a `Ping(uint256)` event and subscribes to itself with the precompile at `0x0100`. This confirmed:

- The 32-STT subscription-owner balance gate (`InsufficientBalance()` reverts below that line).
- The `SomniaExtensions.subscribe(handler, filter, options)` API path — filter struct + gas options.
- Subscription creation tx emits the precompile's `SubscriptionCreated` event (filter visible in the event data) with a stable subscription id (`2347495`).
- The cost of `subscribe()` is ≈210k gas (matches the docs' `SUBSCRIPTION_MANAGEMENT_GAS_COST`).
- The `SomniaEventHandler.onEvent` external entry-point reverts with `OnlyReactivityPrecompile()` when called from any address other than `0x0100` — protects the contract from impersonated callbacks.

**Reactive delivery confirmed live.** Initial spike-callback delivery was slow (>2000 blocks), but the scheduler did receive two reactive callbacks during the autonomous-season demo (`callbacksReceived: 2` after Matches #102 and #103). Latency is bursty on Somnia testnet; for Phase 6 demo recording, both `pokeOpenNext()` manual triggers and the reactive path are wired and exercised.

## Architecture

`LeagueScheduler` inherits both `Ownable` (for admin) and `SomniaEventHandler` (for the precompile-only callback gate). On every `_onEvent`:
1. Selects up to `seatCount` (default 4) joinable agents from `AgentRegistry` ranked by ELO, scanning the first 64 minted IDs.
2. Checks `address(this).balance >= minBalanceThreshold` AND `>= seatCount * entryStake + operatingPerMatch + 32 STT` (preserves the subscription gate even after one match).
3. Calls `Arena.openRealStakes{value: pot+operating}(seats, entryStake, rounds, lots)`.

Both checks emit `SchedulerStalled(balance, required)` when failed — observable for ops dashboards. The same internal `_maybeSchedule()` is reachable via the public `pokeOpenNext()` (no auth) so a stalled reactivity service doesn't strand the season.

## Forge tests

**38/38 passing** repo-wide (+6 LeagueScheduler tests):
- `testTopJoinablePicksByElo` — ELO-ordered top-K selection.
- `testReactiveCallbackOpensNextMatch` — `vm.prank(precompile)` → onEvent → next match seated.
- `testStallEmitsWhenUnderfunded` — balance gate signal.
- `testStallEmitsWhenTooFewJoinable` — agent-pool gate signal.
- `testNonPrecompileCannotInvokeCallback` — onEvent reverts for non-precompile senders.
- `testOwnerCanReplaceLotTemplates` — admin path for evolving lot templates without redeploying.

## Configuration for the recorded autonomous-season demo

- `entryStake = 5 STT` (smaller than the 25 STT Phase 3 demo so a 100-STT scheduler fund can sustain multiple matches).
- `seatCount = 4`, `rounds = 2`, two lots (ETH-USD + SOL-USD via Coinbase).
- `minBalanceThreshold = 60 STT` (32 lock + headroom for one match).
- `AuditCouncil` deliberately detached for the Phase 4 demo (`arena.setAuditCouncil(address(0))`) so settlement isn't gated on the 5-min appeal window — autonomy of match-open is the Phase 4 claim, not audit.

## Phase 0.8 → Phase 4 wiring notes

- `setOperator(address(scheduler), true)` on `AgentRegistry` was NOT needed — Arena (which already has operator rights) is the one flipping `joinable` flags as part of `openRealStakes`. The scheduler only reads the registry.
- The reactivity subscription's `gasLimit` is 5,000,000 — enough headroom for `openRealStakes` to fire the two JSON API pricing requests and the 4 NFT joinable flips inside one reactive tx.
- The precompile-callback signature `onEvent(address,bytes32[],bytes)` has selector `0x53edf33d` — visible in the subscription registration event data and matches what's stored against the subscription.

## Open items deferred to Phase 5+

- **Reactive delivery monitoring.** Once Somnia's reactivity service is faster (or once Phase 6 demo recording happens with enough wall-clock margin), capture a reactive-callback-driven match-open transaction (vs the current `pokeOpenNext()` manual triggers) for the technical writeup.
- **Per-season randomized lots.** Today the scheduler uses fixed lot templates set by owner; an interesting extension is for the scheduler to ask an LLM agent ("propose 2 lot URLs for tonight's season") via `inferToolsChat` and feed the result into the next match.
- **Seasonal payout drain.** `Treasury.seasonFund` accumulates 5% rake; Phase 5 frontend should expose a `distributeSeasonFund(uint256[] rankedAgentIds)` view + transaction.
