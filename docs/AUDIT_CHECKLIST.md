# Bazaar contract audit checklist

Per-contract verification of the four non-negotiable Somnia integration rules + Bazaar-specific invariants. Run before any redeployment or merge to `main`.

The rules (from `bazaar.md` §2.4 / `CLAUDE.md`):

1. **Deposit math:** `msg.value = getRequestDeposit() + perAgentPrice × subcommitteeSize`. Floor alone sets `perAgentBudget=0` → runners skip → timeout.
2. **`receive() external payable {}`** on every requester (rebate target). Missing → `NativeTransferFailed` → stuck funds.
3. **Gate every callback:** `require(msg.sender == platform)` + `pendingRequests` mapping. Callback is `external`.
4. **Decode safely:** check `status == Success` AND `responses.length > 0` before `abi.decode(responses[0].result, ...)`.

Plus:

5. **Reactivity subscriptions filter on `eventTopics` / `origin` / `emitter`** — never wildcards.
6. **Subscription owner ≥32 STT** held continuously (precompile enforces).
7. **ReentrancyGuard + checks-effects-interactions** on any contract that sends value.

---

## `contracts/src/lib/AgentPlatformBase.sol`

The shared base. If this is correct, every inheriting contract is correct *by construction*.

| Rule | Where | OK |
|---|---|---|
| 1 — deposit math | `_send` line 71 (`_depositFor`) + `_sendAdvanced` line 93 (`_advancedDepositFor`). Helpers compute `floor + perAgentPrice * subcommitteeSize`. | ✅ |
| 2 — `receive()` | line 112 — `receive() external payable {}` | ✅ |
| 3 — callback gate | `onPlatformCallback(requestId)` modifier (lines 38–43) checks `msg.sender == platform` AND `pendingRequests[requestId] != 0`. Modifier `delete pendingRequests[requestId]` at the end prevents replay. | ✅ |
| 4 — safe decode helper | `_isSuccess(status, responses)` at line 105 — returns true only when `Success` + non-empty. Every inheriting callback must use this before decoding. | ✅ (verified at call sites below) |

**Phase 1 fix preserved**: `_send` and `_sendAdvanced` draw from `address(this).balance`, not `msg.value`. This lets callbacks fire follow-up requests (which arrive with `msg.value == 0`). The cost: external callers must pre-fund the contract for the whole match before opening.

---

## `contracts/src/Arena.sol`

| Rule | Where | OK |
|---|---|---|
| 1 | Inherited via `_send` and `_sendAdvanced`. All `_firePricingRequest` / `_fireMoveRequest` use `_send`. | ✅ |
| 2 | Inherited from `AgentPlatformBase.receive()`. | ✅ |
| 3 | `handlePricing` (line 289) and `handleMove` (line 440) both use `onPlatformCallback(requestId)`. Both are `external` per design (called by platform). | ✅ |
| 4 | `handlePricing` checks `_isSuccess` before `abi.decode(responses[0].result, (uint256))` (line 295). `handleMove` checks `_isSuccess` before `abi.decode(responses[0].result, (string))` (line 448). | ✅ |
| 7 | `_settle` is internal and computes scores before any external call. Treasury settlement is the last operation; Treasury itself has `nonReentrant`. Arena doesn't transfer ETH itself except via Treasury's escrow path. | ✅ |
| Bazaar-specific | `openExhibition` / `openRealStakes` are `external payable` — the only entry points that take value. Stake math enforced via `expected = entryStake * agentIds.length`. | ✅ |
| Bazaar-specific | `_applyMove` rejects illegal moves through `RulesEngine.parse` + state checks (lot ownership, budget, standing offer). Phase 2 tied-bid quirk fixed (line ~487 — explicit `offer must beat standing` reject). | ✅ |
| Bazaar-specific | `forfeitPenalty` is owner-settable, default 100 — caps the previously-runaway `-budget-in-wei` penalty (Phase 2 finding). | ✅ |

---

## `contracts/src/AuditCouncil.sol`

| Rule | Where | OK |
|---|---|---|
| 1 | Inherited via `_sendAdvanced`. Verdict requests use the `Threshold` deposit math; parse-check requests likewise. | ✅ |
| 2 | Inherited from `AgentPlatformBase.receive()`. Plus dedicated `fund()` helper at line 135 for top-up clarity. | ✅ |
| 3 | `handleVerdict` (line 324) and `handleParseCheck` (line 396) both use `onPlatformCallback(requestId)`. | ✅ |
| 4 | Both callbacks check `_isSuccess` before decoding. `handleVerdict` aggregates `responses` array via `_tallyVerdicts` (also safe — each response checked individually for `Success`). `handleParseCheck` aggregates via `_medianUint` (same per-response safety). | ✅ |
| Bazaar-specific | `beginAudit` is gated by `msg.sender == arena` (line 167). Only the Arena can initiate an audit. | ✅ |
| Bazaar-specific | VRF callback (`_fulfillRandomWords` via `VRFConsumerBase.rawFulfillRandomWords`) is gated by `msg.sender == address(vrfWrapper)` (line 56 of `VRFConsumerBase.sol`). | ✅ |
| Bazaar-specific | `appealTimeout` is permissionless — anyone can flush a stuck audit after `appealUntil`. Intentional. Documented in TECHNICAL.md. | ✅ |

---

## `contracts/src/Treasury.sol`

| Rule | Where | OK |
|---|---|---|
| 2 | `receive() external payable {}` at line 231. | ✅ |
| 7 | `settleMatch` and `refundMatch` both `nonReentrant`. Pot is zeroed AND `settled`/`refunded` flag set BEFORE the loop of `.call{value}` transfers (checks-effects-interactions). | ✅ |
| 7 | Failed payouts (`.call` returns false) route to `seasonFund` rather than reverting — funds never get stuck. | ✅ |
| Operator gates | `escrowMatch`, `settleMatch`, `refundMatch`, `freezeMatch`, `unfreezeMatch` all `onlyOperator`. Arena + AuditCouncil registered as operators in the Phase 3 deploy script. | ✅ |
| Owner gates | `setOperator`, `setSeasonFundRecipient`, `drainSeasonFund` all `onlyOwner`. | ✅ |
| Stake math | `escrowMatch` requires `msg.value == entryStake * agentIds.length` exactly. | ✅ |

Treasury doesn't call the agent platform — rules 1, 3, 4 don't apply.

---

## `contracts/src/LeagueScheduler.sol`

| Rule | Where | OK |
|---|---|---|
| 2 | `receive() external payable {}` at line 218. Reactivity precompile pays callback gas from this balance. | ✅ |
| 5 | Subscription filter: `eventTopics[0] = matchFinalizedTopic`, `origin: address(0)`, `emitter: address(arena)` (lines 107–116). Explicit emitter — not a wildcard. | ✅ |
| 6 | `SomniaExtensions._subscribe` reverts `InsufficientBalance` if `address(this).balance < 32 ether`. Verified in Phase 0.8 spike + Phase 4 deploy. | ✅ |
| Callback gate | Inherited from `SomniaEventHandler.onEvent` — reverts unless `msg.sender == 0x0100` (the reactivity precompile). `_onEvent` is internal; only path in is via the gated external. | ✅ |
| Owner gates | `setSeatCount`, `setRounds`, `setEntryStake`, `setLotTemplates`, `start`, `stop`, `withdraw` all `onlyOwner`. | ✅ |
| Permissionless escape | `pokeOpenNext()` is intentionally unauthed — runs the same `_maybeSchedule()` the precompile would. Internal balance + agent-count checks gate it; no auth needed. | ✅ |
| Owner-funded operating | `withdraw` requires `subscriptionId == 0` so funds can't be pulled while the subscription is active. | ✅ |

Scheduler doesn't call the agent platform — rules 1, 3, 4 don't apply.

---

## `contracts/src/AgentRegistry.sol`

Standard ERC-721 + persona/ELO storage. Doesn't call the agent platform — rules 1, 2, 3, 4 don't apply directly.

| Invariant | Where | OK |
|---|---|---|
| Operator gates | `setJoinable`, `recordResult` are `onlyOperator`. Operators are wired by owner; Arena registered in Phase 1 deploy, Council not needed (read-only access). | ✅ |
| Mint permissionlessness | `mint` is callable by anyone. The owner of the resulting NFT is the `to` parameter. Cost is zero (no stake at mint time). | ✅ |
| Default ELO | All new agents start at `DEFAULT_ELO = 1500` (line 17). | ✅ |

---

## VRFConsumerBase and IVRFV2PlusWrapper (`contracts/src/lib`, `contracts/src/interfaces`)

| Item | Verification |
|---|---|
| Native-payment `extraArgs` tag = `0x92fd1338` | Confirmed via on-chain wrapper acceptance (Phase 0.9). |
| `rawFulfillRandomWords` gated on `msg.sender == address(vrfWrapper)` | Yes, `VRFConsumerBase.sol` line 56. |
| Wrapper price stable per request size | 0.002052 STT for 3-words / 200k-gas — stored in `quote()` view for spike. |

---

## Reactivity vendor copy (`contracts/lib/somnia-reactivity-contracts`)

Files copied verbatim from `@somnia-chain/reactivity-contracts@0.2.0`:
- `SomniaEventHandler.sol`
- `interfaces/SomniaExtensions.sol`
- `interfaces/ISomniaReactivityPrecompile.sol`
- `interfaces/ISomniaEventHandler.sol`
- `interfaces/IERC165.sol`

Foundry remapping at `contracts/foundry.toml`:
```
"@somnia-chain/reactivity-contracts/=lib/somnia-reactivity-contracts/"
```

No modifications. If Somnia publishes a newer version, replace the tarball and re-build.

---

## Test coverage summary

`forge test` — **38 / 38 passing**:

| Suite | Tests |
|---|---|
| `test/RulesEngine.t.sol` | 9 |
| `test/AgentRegistry.t.sol` | 4 |
| `test/Treasury.t.sol` | 6 |
| `test/Arena.t.sol` | 7 (incl tied-bid + all-forfeited regressions) |
| `test/AuditCouncil.t.sol` | 6 (clean / suspect quorum / parse drift / appeal timeout / competitor exclusion / non-Arena reject) |
| `test/LeagueScheduler.t.sol` | 6 (top-K by ELO / reactive callback / stall paths / non-precompile reject / lot template admin) |

---

## Notes for any future redeploy

1. **`bumpMatchCounter` if reusing a Treasury.** Treasury indexes escrow by `matchId`; a redeployed Arena starting at 1 will collide with a prior Arena's matches that share the same Treasury. Owner calls `arena.bumpMatchCounter(N)` post-deploy to skip past existing ids.
2. **Add Arena AND AuditCouncil as Treasury operators** when deploying Phase 3 anew.
3. **Fund AuditCouncil before opening the first audited match** — VRF + verdicts + parse checks together cost ~3 STT per audit; council needs ≥5 STT plus a safety margin.
4. **Fund LeagueScheduler before calling `start()`** — the precompile reverts on subscribe if balance < 32 STT.
5. **Re-verify base-agent IDs against the live Agent Explorer** when porting to mainnet. Mainnet uses different IDs (and the verified-resources doc names mainnet platform address `0x5E5205CF39E766118C01636bED000A54D93163E6`).
