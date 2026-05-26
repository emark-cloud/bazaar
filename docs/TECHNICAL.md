# How Bazaar uses the Agentic L1

A technical walkthrough for judges and developers: which Somnia primitives Bazaar actually invokes, what the consensus model means in practice, how every failure path is handled, and what we learned during the build that wasn't in the docs.

---

## 1. The architectural claim

Bazaar runs as a **self-driving on-chain system**. Four contracts (Arena, Treasury, AuditCouncil, LeagueScheduler) talk to **three Somnia base agents** (LLM Inference, JSON API Request, LLM Parse Website) and **two Somnia primitives** (the reactivity precompile and Protofire's VRF v2.5 wrapper). No keeper. No oracle. No off-chain orchestrator.

The only addresses that interact with Bazaar from outside the chain are:
1. The Bazaar contracts' own deployer — used to mint the four default personas and to top up balances. Setting up the league, not running it.
2. Anyone holding a Bazaar agent NFT — they don't *trigger* matches; the scheduler seats them automatically when they're top-ranked.
3. Optional `pokeOpenNext()` callers — a permissionless manual-trigger fallback that exercises the exact same internal code path the reactivity precompile uses.

Every other transition — open match, fetch price, run negotiation turn, settle, audit, refund — happens inside a chain of `createRequest → consensus → callback` hops orchestrated entirely by Solidity.

---

## 2. The `createRequest` / callback flow

This is the heart of every Bazaar interaction with the agent platform. The same five-step pattern repeats for every pricing call, every negotiation turn, every audit verdict.

```
Bazaar contract                    Agent Platform (0x037Bb9C7…)        Subcommittee
       │                                    │                                │
       │ createRequest{value: deposit}      │                                │
       ├───────────────────────────────────▶│                                │
       │                                    │ pick K validators (Majority)   │
       │                                    │ ──────────────────────────────▶│
       │                                    │                                │ run inference / fetch / parse
       │                                    │ ◀──────────────────────────────│ submit signed response
       │                                    │ aggregate by consensus rule    │
       │ ←── callback(requestId, responses, status, request)                 │
       │                                                                     │
       │ rebate unused deposit (Native transfer to receive())                │
       │ ◀───────────────                                                    │
       │                                                                     │
       │ check status, decode result, advance state                          │
```

The Bazaar contract's job: build the right payload, send the right deposit, gate the callback, decode safely. The platform's job: run consensus and rebate the leftover.

`contracts/src/lib/AgentPlatformBase.sol` is the shared base every Bazaar requester inherits. It bakes the four non-negotiable rules into reusable helpers so no per-contract integration mistake is possible. The relevant bits:

```solidity
function _send(
    uint256 agentId,
    bytes4 callbackSelector,
    bytes memory payload,
    uint256 perAgentPrice,
    uint256 subcommitteeSize,
    bytes32 context
) internal returns (uint256 requestId) {
    uint256 deposit = platform.getRequestDeposit() + (perAgentPrice * subcommitteeSize);
    if (address(this).balance < deposit) revert Underfunded(address(this).balance, deposit);
    requestId = platform.createRequest{value: deposit}(agentId, address(this), callbackSelector, payload);
    pendingRequests[requestId] = context;
    emit RequestSent(requestId, agentId, deposit);
}

modifier onPlatformCallback(uint256 requestId) {
    if (msg.sender != address(platform)) revert NotPlatform(msg.sender);
    if (pendingRequests[requestId] == bytes32(0)) revert UnknownRequest(requestId);
    _;
    delete pendingRequests[requestId];
}

function _isSuccess(ResponseStatus status, Response[] memory responses)
    internal pure returns (bool)
{
    return status == ResponseStatus.Success && responses.length > 0;
}

receive() external payable {}
```

`_isSuccess` is rule 4 ("never decode without checking"). The receive is rule 2. The modifier is rule 3. The deposit-math line is rule 1.

The one departure worth flagging: `_send` uses `address(this).balance` instead of `msg.value`. This is **deliberate** — the platform's callback into our contract arrives with `msg.value == 0`, but our contracts often need to fire follow-up requests from inside callbacks (every move advance, every Phase 3 audit step). External callers `payable`-fund the contract up front; subsequent internal hops draw from balance. The cost: every external caller is responsible for sending the full match's worth of operating funds at open time. The benefit: the entire match runs as one chain of callbacks with no out-of-band funding required.

---

## 3. The four non-negotiable Somnia rules — verified per contract

The agent platform's docs list four rules whose violation produces silent timeouts or stuck funds rather than visible reverts. Every Bazaar requester is checked against all four; `docs/AUDIT_CHECKLIST.md` is the per-contract verification matrix.

| # | Rule | Detection if violated | Bazaar's compliance |
|---|---|---|---|
| 1 | `msg.value = getRequestDeposit() + perAgentPrice × subcommitteeSize` | Floor alone sets `perAgentBudget=0` → validators skip → timeout | `AgentPlatformBase._depositFor` / `_advancedDepositFor` enforce; `_send` reverts `Underfunded` |
| 2 | `receive() external payable {}` on the requester | Rebate transfer fails → `NativeTransferFailed` event → stuck funds | Implemented at `AgentPlatformBase` level — every inheriting contract gets it |
| 3 | Callback gated by `require(msg.sender == platform)` + `pendingRequests` mapping | Without it, anyone can call the public callback and forge a verdict | `onPlatformCallback(requestId)` modifier; applied on every callback in Arena/AuditCouncil |
| 4 | Check `status == Success` AND `responses.length > 0` before decoding | Bare decode reverts with cryptic message; UI sees "transaction failed" with no signal | `_isSuccess(status, responses)` guard at every callback's first branch |

---

## 4. Consensus choices — `Majority` vs `Threshold`

Somnia's agent platform supports two consensus modes. Picking the right one per call type is the architectural decision that makes everything else possible.

| Where | Mode | Subcommittee | Threshold | Why |
|---|---|---|---|---|
| `Arena._fireMoveRequest` (every negotiation turn) | `Majority` | 3 | — | `inferChat` is **deterministic** for the model + temperature Somnia runs (verified in Phase 0). Same prompt → same response across validators → Majority just returns the consensus result, no aggregation needed. Cheap and fast. |
| `Arena._firePricingRequest` (lot pricing) | `Majority` | 3 | — | `JSON API Request` against a stable HTTP endpoint → all validators see the same bytes → Majority. Same logic as moves. |
| `AuditCouncil._fireVerdict` (per auditor's audit call) | `Threshold` | 5 | 3 | `inferString` with `allowedValues=["clean","suspect"]` constrains the output to one of two strings, but it's an auditor's *judgment* — we want **5 validators voting**, not deterministic byte-match. Threshold returns all 5 raw responses; we tally on-chain (`AuditCouncil._tallyVerdicts`). |
| `AuditCouncil._fireParseCheck` (per-lot Parse Website cross-check) | `Threshold` | 5 | 3 | `LLM Parse Website` runs `Qwen3-30B-A3B` at `temperature: 0.7, top_p: 0.8` — **non-deterministic** (Phase 0 finding). Each validator returns a different number. We take the median of successful responses on-chain (`_medianUint`) before comparing to the feed. |

The Phase 0 verification that `inferChat` is deterministic under realistic prompt sizes is what lets the negotiation loop run on `Majority` with subcommittee 3 — about **0.24 STT per move** (deposit ceiling; ~70% rebated). If the determinism had failed, the fallback documented in `TODO.md` (Phase 0.4a) was: use `Threshold` and have the contract pick a canonical move from the raw responses (e.g., lowest-keccak). Not invoked, but coded into the design.

---

## 5. The negotiation move loop — verified flow

Phase 1's recorded Match #1 timeline shows the full pattern. Block 392455795 → 392455872 (~80 seconds, 8 turns + 2 lot pricings):

```
Arena.openExhibition()
  ├─ for each lot: _firePricingRequest (createRequest → JSON_API_REQUEST)
  ├─ each fetchUint callback → handlePricing → commits sealed value
  │
  └─ when all lots priced: phase = Negotiating, _fireMoveRequest
       ├─ build prompt (system: persona, user: state + log)
       ├─ createRequest → LLM_INFERENCE → handleMove
       │    ├─ if !_isSuccess → applyDefault → advanceTurn
       │    ├─ else parse via RulesEngine → applyMove or reject
       │    └─ log the move, advance turn
       │
       └─ when round == rounds → _toSettling → _settle
            ├─ resolve standing offers (last bidder wins)
            ├─ reveal lots, compute scores, ELO updates
            ├─ emit MatchSettled + WinnerDeclared
            └─ if RealStakes:
                 ├─ if auditCouncil wired: auditCouncil.beginAudit
                 └─ else: treasury.settleMatch
```

The state machine never blocks on a single agent. Every failure path has a defined match-advancing default (next section). The longest acknowledged delay is the audit appeal window (default 5 minutes), and even that has `appealTimeout()` for liveness.

---

## 6. Failure modes and their handling

Verbatim from `bazaar.md` §7. Every entry has been exercised in tests or in a recorded run.

| Failure | Detection | Handling |
|---|---|---|
| Agent request `TimedOut` (status 4) | callback `status == 4` | Apply default `PASS` for that turn; emit `MoveDefaulted`; continue. Three consecutive timeouts for one agent → that agent forfeits (score = −forfeitPenalty, default 100); the match continues. |
| Agent request `Failed` (status 3) | callback `status == 3` | Same as timeout. The match never blocks on a single agent. |
| LLM returns **illegal move** (bad lot, over budget, wrong phase, unparseable) | `RulesEngine.parse` + Arena state validation in callback | Reject, emit `MoveRejected` with the reason. Increments the consecutive-default counter but no other penalty. |
| Empty `responses` on `Success` | `_isSuccess` length check | Treated as failed; default `PASS`. |
| JSON API pricing feed stale / wrong | AuditCouncil's Parse-Website cross-check vs the sealed value | If drift > `parseToleranceBps` (default 1000 = 10%), audit verdict suspects; if quorum, `Treasury.refundMatch` returns entry stakes; no ELO change. |
| Underfunded deposit | `require(address(this).balance >= deposit)` in `_send` | Reverts before any state change. |
| Callback griefing (forged `handleMove`) | `onPlatformCallback` modifier (msg.sender + pendingRequests) | Reverts. |
| Rebate transfer fails | platform emits `NativeTransferFailed` | `receive()` is implemented; absent transfer failure mode hasn't been hit. |
| Reentrancy on payout | `nonReentrant` on `Treasury.settleMatch` + checks-effects-interactions | Payouts computed and zeroed before any `.call{value}`. |
| Payout `.call` fails (e.g., owner is a contract that rejects ETH) | per-call `bool ok` check | Re-route the amount to `seasonFund`; emit `PayoutFailed` for human follow-up. |
| AuditCouncil inconclusive (no VRF, no verdicts) | `appealUntil` deadline | Anyone calls `appealTimeout(matchId)` — fails open to clean. Treasury unfreezes + settles. |
| `LeagueScheduler` underfunded | balance check before each `_maybeSchedule` | Emits `SchedulerStalled(balance, required)`; existing matches finish; refill resumes scheduling. |
| `LeagueScheduler` no eligible agents | top-K returns < K | Same `SchedulerStalled` event; the scheduler waits until enough agents become joinable. |
| Sub-balance below 32 STT | precompile-level `InsufficientBalance` on subscribe | Caught at subscription time; deploy script funds 33 STT to guarantee margin. |

---

## 7. Verified primitives — exact selectors, exact prices

These were nailed down in Phase 0 verification spikes and are the source of truth for the entire build.

### 7.1 Agent IDs (Shannon testnet)

```
LLM_INFERENCE       = 12847293847561029384
JSON_API_REQUEST    = 13174292974160097713
LLM_PARSE_WEBSITE   = 12875401142070969085
```

Pulled from `agents.testnet.somnia.network`. The docs hard-code only Parse Website (the others were placeholders). **The Agent Explorer is canonical; docs are stale.**

### 7.2 Per-agent prices (subcommittee 3 default)

| Agent | Per-agent price | Typical deposit (floor + price×3) | Empirical effective cost (~70% rebated) |
|---|---|---|---|
| `JSON API Request` | 0.03 STT | ~0.12 STT | ~0.04 STT |
| `LLM Inference` | 0.07 STT | ~0.24 STT | ~0.08 STT |
| `LLM Parse Website` | 0.10 STT | ~0.33 STT | ~0.11 STT |

A full 4×5 RealStakes match (4 lots, 5 rounds) burns about **10 STT in agent fees** plus the entry-stake pot.

### 7.3 The `inferToolsChat` selector

The Agent Explorer's snippet uses a placeholder `tuple[]` with no field schema. We reverse-engineered the canonical signature via raw-selector probing (see `contracts/src/spikes/RawSelectorSpike.sol`):

```
inferToolsChat(string[],string[],string[],(string,string)[],uint256,bool) = 0xd0683905
```

The `OnchainTool` struct shape is two strings (likely `name` + `description`). Bazaar passes an empty array — only the MCP path is exercised — so the field names don't matter, but the struct shape must be in the interface or the selector is wrong. End-to-end test against `https://mcp.deepwiki.com/mcp` returned `"Solidity"` for the primary-language query against `foundry-rs/foundry`. The MCP path completes in **one invocation** (no `tool_calls` resume loop).

### 7.4 Parse Website's structured output

```jsonc
{
  "reasoning": "...",
  "answerable": true,
  "confidence_score": 78,
  "<user-named field>": <value>
}
```

The audit gating is: `answerable == true` AND `confidence_score >= parseConfidenceMin` (default 30). Phase 0 found that `simple.wikipedia.org`-class pages with direct URLs (`resolveUrl=false`, `numPages=1`) and concrete single-value questions ("What is the speed of light as a single integer in km/s?") work reliably; `resolveUrl=true` + a question-shaped prompt is brittle (the prompt becomes the search query).

### 7.5 VRF v2.5 native-payment encoding

```solidity
bytes constant EXTRA_ARGS_V1_TAG = 0x92fd1338;  // bytes4(keccak256("VRF ExtraArgsV1"))
bytes memory extraArgs = abi.encodeWithSelector(EXTRA_ARGS_V1_TAG, true);
```

Used in `VRFConsumerBase._extraArgsNative`. Wrapper price for 3-words / 200k-callback: **0.002052 STT** stable across runs.

### 7.6 Reactivity precompile address

```
SOMNIA_REACTIVITY_PRECOMPILE_ADDRESS = address(0x0100)
SUBSCRIPTION_OWNER_MINIMUM_BALANCE   = 32 ether
```

`tx.origin` inside a callback is the subscription owner; `msg.sender` is `0x0100`. The base contract's external `onEvent` validates the latter.

---

## 8. Receipt-driven debugging

Somnia exposes a per-request receipt at `https://agents.testnet.somnia.network/receipts/<requestId>` showing the actual LLM reasoning trace, the per-validator responses, the consensus decision, the rebate amount. This is the source of truth when something is wrong.

Limitations observed:
- The page is **fully client-rendered**. `curl` returns an empty SPA shell; programmatic readout requires a headless browser.
- `platform.getRequest(uint256)` reverts with custom error `0x4ec726c7` for finalized requests on the testnet platform. Either requests are pruned post-finalization or the struct decode is slightly off (deferred open question).

Bazaar's trace layer (frontend `TraceWaterfall`) builds a stylized waterfall locally from event timing and **links out** to the receipt page in a new tab. Truth lives in the receipt; the on-screen visualization is convenience.

---

## 9. Failure semantics: validation vs agent

Both validation rejections and agent execution failures finalize with `ResponseStatus.Failed (3)`. They have very different meanings (one is "your payload was malformed", the other is "the agent ran but couldn't produce output"), but the platform doesn't tag them.

The Phase 0/1 empirical finding: **validation failures finalize in <5 blocks; agent failures take 30+ blocks.** The indexer (`indexer/src/platform.ts`) uses this as `failureKind`:

```typescript
const delta = ev.block.number.minus(r.createdAtBlock).toI32();
r.failureKind = delta < VALIDATION_LATENCY_BLOCKS ? "validation" : "agent";
```

The frontend can show validation rejections as "request invalid" and agent failures as "agent timed out" — different problem categories.

---

## 10. The autonomy argument

The Demo Engineer prompt is: build something that *needs* an agentic L1.

Bazaar's negotiation move loop is `inferChat` calls in series — the LLM is part of the consensus pipeline, not a side service. The audit council's verdicts use `inferString` under `Threshold` consensus — multi-agent verification baked into the chain's settlement guarantee. The pricing path uses `JSON API Request` — the contract reads HTTP without a Chainlink-style aggregator. The scheduler subscribes to its own emitted events via the reactivity precompile, paying validators per callback from a 32-STT lock.

Strip those primitives and the system becomes: a Solidity contract that calls a Chainlink-Functions-style external service, hopes for a callback, trusts the off-chain returned data, and waits for a human to start the next round. That is not the same product.

The autonomy claim is the difference between "agents on a smart contract" (the trivial layer of putting an off-chain agent's wallet on-chain) and "agents *in* the consensus" (every LLM call is a validated, audited, on-chain step). Bazaar exists on the second axis.

---

## 11. What we learned that wasn't in the docs

A short list of things Phase 0 surfaced that the documentation didn't (or got wrong). All captured in `TODO.md` carry-forward sections.

- **The Agent Explorer is the source of truth, not the docs page.** Every base agent's docs page had at least one missing or stale parameter. Always verify on `agents.testnet.somnia.network`.
- **`inferToolsChat`'s `OnchainTool` struct shape** is undocumented; we found it via raw-selector probing (Phase 0.7 — `RawSelectorSpike.sol`).
- **`LLM Parse Website` is non-deterministic** (temp 0.7, top_p 0.8). AuditCouncil must use `Threshold` + on-chain median, NEVER `Majority`. The docs don't flag this.
- **Parse Website returns a 4-field structured output**, not just the requested value. Audits must check `answerable` AND `confidence_score` before trusting the value.
- **Forge's local simulator can't model Somnia's custom opcodes.** `forge script` against the testnet reverts with `NotActivated` when reading platform state. Use `cast call` for views and `--skip-simulation --broadcast` for writes, or write `forge create` + standalone `cast send` sequences for any contract that touches the precompile (VRF wrapper, reactivity precompile).
- **`platform.getRequest(uint256)` reverts on finalized requests with `0x4ec726c7`.** Pruning behavior or decode mismatch — left as an open question; doesn't block anything since the receipts service is the canonical UI.
- **`forge build` with `inferToolsChat`'s 6-tuple return** stack-overflows the default IR. Add `via_ir = true` to `foundry.toml`.
- **OpenZeppelin v5.6 uses `mcopy`** → set `evm_version = "cancun"`.

---

## 12. Cost model (Shannon testnet, verified)

| | |
|---|---|
| 4×2 exhibition (Match #1) | ~2.5 STT total (agent fees only; no escrow) |
| 4×2 RealStakes (Match #2/#3) | 100 STT pot escrowed + ~5 STT operating + 5 STT rake retained = ~10 STT net cost |
| 4×2 RealStakes + audit (Match #3) | + ~0.003 STT VRF + ~3 STT verdicts + parse checks. Refunded on suspect; settled on clean. |
| Single reactivity subscription | 32 STT permanent lock + ~210k gas to create + per-callback gas paid from the lock |
| 4×5 RealStakes (full match) projected | ~9.5–11 STT total agent fees (matches spec §6) |
| 3 RealStakes seasons + 1 exhibition (Phase 6 target) | ~150–200 STT budget once stakes recycle to NFT owners |

Empirical per-call rebate ≈ 70% of deposit ceiling. The two-pot deposit model (floor + per-agent) is the difference between "cheap" and "stuck timeout."

---

## 13. Where to look in the code

| If you want… | Read… |
|---|---|
| The platform integration pattern | `contracts/src/lib/AgentPlatformBase.sol` |
| A canonical reference implementation | `contracts/src/spikes/MoveDecider.sol` (Phase 0.4 — the "hello world") |
| The full move loop | `contracts/src/Arena.sol` — `_fireMoveRequest`, `handleMove`, `_applyMove`, `_settle` |
| The rules engine | `contracts/src/lib/RulesEngine.sol` |
| The audit pipeline | `contracts/src/AuditCouncil.sol` — `beginAudit`, `_fulfillRandomWords`, `handleVerdict`, `handleParseCheck`, `_finalize` |
| The reactivity wiring | `contracts/src/LeagueScheduler.sol` — `start`, `_onEvent`, `_maybeSchedule` |
| The minimal Reactivity vendor copy | `contracts/lib/somnia-reactivity-contracts/contracts/` |
| The trace UI | `frontend/src/components/TraceWaterfall.tsx` |
| The indexer mappings | `indexer/src/*.ts` |
| The starter kit | `starter-kit/template/` (the scaffold output) |

Every contract has been audited against the four Somnia rules — see `docs/AUDIT_CHECKLIST.md`.
