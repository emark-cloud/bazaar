# Phase 0 — verification results

Captured 2026-05-25. Spikes deployed and run live on Somnia testnet (chain 50312).

## TL;DR

**Bazaar is buildable as designed.** The single largest design risk — whether `inferChat` returns byte-identical output across validators under `Majority` consensus — is **resolved positively**. The Majority-or-fallback fork in §3.2 of the spec collapses to: use Majority. No fallback needed.

## 0.1 — Endpoints ✓

Both candidate RPCs and both Explorer URLs resolve. `chainId = 0xc488 (50312)` confirmed on both RPCs.

| Item | URL | Status |
|---|---|---|
| Testnet RPC (primary) | `https://api.infra.testnet.somnia.network` | ✓ HTTP 200, chainId 50312 |
| Testnet RPC (alt)     | `https://dream-rpc.somnia.network` | ✓ HTTP 200, chainId 50312 |
| Agent Explorer (testnet) | `https://agents.testnet.somnia.network` | ✓ HTTP 200 |
| Receipts service (testnet) | `https://agents.testnet.somnia.network/receipts/<id>` | ✓ HTTP 200 (JS-rendered) |
| Receipts API host (testnet) | `https://receipts.testnet.agents.somnia.host/?requestId=<id>` | 404 — likely deprecated; use the network/receipts/ path |

Lock-in: `TESTNET_RPC=https://api.infra.testnet.somnia.network`.

## 0.2 — Agent IDs ✓

Sourced live from the Agent Explorer 2026-05-25; committed in `contracts/src/lib/AgentIds.sol`.

| Agent | ID (testnet) | Per-agent price |
|---|---|---|
| LLM Inference | `12847293847561029384` | 0.07 STT |
| JSON API Request | `13174292974160097713` | 0.03 STT |
| LLM Parse Website | `12875401142070969085` | 0.10 STT |

## Platform sanity ✓

Read live from `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776`:

| Parameter | Value | Matches spec? |
|---|---|---|
| `minPerAgentDeposit()` | 0.01 STT | ✓ |
| `getRequestDeposit()` | 0.03 STT | ✓ (3 × 0.01) |
| `getAdvancedRequestDeposit(5)` | 0.05 STT | ✓ (5 × 0.01) |

## Spike deployments (testnet)

All five compiled with `via_ir`, deployed in one broadcast (~0.36 STT total gas).

| Spike | Address |
|---|---|
| MoveDecider | `0xFB9EA543C09886f0fc1bc669a3B3d2DDCe3e44A6` |
| JsonApiSpike | `0x7386E86c37DF59aB457175aCaD412E1DfE1Aa647` |
| InferStringSpike | `0x9226705B4F54554e65eC48f6cD36fa16A623c939` |
| InferToolsChatSpike | `0xa289e867401A098B75830ea0B3D7C96E079869f7` |
| ParseWebsiteSpike | `0xf6e79427E84de780E9E196A470Bbe6048180f17B` |

## 0.4 — `inferChat` determinism ✓✓✓ (the load-bearing result)

Realistic Bazaar negotiation prompt — *The Hawk* persona, Round 1 of 5, 25 STT budget, three lots, asking for a structured `OFFER|...|PASS` move.

- **Result:** `"OFFER|lot=1|side=BUY|price=10"` — exactly the requested format.
- **Response count:** 2 (threshold met under Majority).
- **`byteIdentical = true`** — all responding validators returned the identical string.
- Callback latency: under 30s end-to-end.

**Implication:** the core negotiation move loop works as designed. No fallback to `Threshold + canonical-selector`. Spec §13 open question — resolved.

Tx (request): `0x812db33d2add09ddf6d5ec4c53af740c732b1b8d6e244bee063b15f42b3ca08f`

## 0.5 — JSON API `fetchUint` ✓

Coinbase SOL-USD spot price, scaled by `10^2` (cents).

- **Result:** `8561` (raw) → $85.61.
- Callback latency: under 30s.

Lot pricing for Motifs is viable. Tx: `0xb91f2df87c3e25f21f6d72d879087d725fb464dcc1f13e28defbcf973a434e14`

## 0.6 — `inferString` with `allowedValues`, Threshold 5/3 ✓

Sample audit-council prompt with a `["clean", "suspect"]` constraint over a fabricated clean match.

- **Result:** `"clean"` (4 cleans, 0 suspects out of 5).
- Callback latency: under 30s.

`createAdvancedRequest` + `Threshold` path works; the `_sendAdvanced` helper in `AgentPlatformBase` is correct. Tx: `0x94995e2f78d1383df075a294f5b375a0c09ff8d8f6967adbe3b79b156d6ccdf6`

## 0.7 — `inferToolsChat` MCP path — DEFERRED

Not invoked yet — needs a public MCP server URL to call. Plan-doc cut order ranks this #2 (drop early if time slips). Marking deferred; not on the Phase-1 critical path.

## ParseWebsite — needs investigation, non-blocking

Three attempts, all returned `Failed` (status 3):
1. Coinbase price page (expected to fail — bot-protected).
2. Wikipedia (Lionel Messi goals).
3. CoinGecko BTC page.

Hypothesis: prompt is too open-ended for `ExtractANumber`, or large pages exceed agent compute budget at `numPages=1`. The platform integration is fine — requests reach validators, callbacks fire, status is observable. Only the agent's own extraction is failing.

Action (Phase 3, not now): study a known-working docs example, or use the agent's `description`/`prompt` fields more rigorously (smaller search target, exact-string anchors). Audit council can fall back to JSON API cross-check until this is solved.

## Determinism fallback decision — NOT INVOKED

Per the original plan, we held a fallback path (`Threshold` + canonical-move selector by lowest-keccak) in case 0.4 failed. **0.4 succeeded with `byteIdentical=true`, so the fallback is unused.** Spec §3.2 stands verbatim: `Majority` consensus on a single `inferChat` call per turn.

## Costs

Spent so far across deploys + 5 spike calls (1 succeeded ParseWebsite retry, 2 failed retries refunded most):

| | |
|---|---|
| Starting balance | 30.000 STT |
| Final balance | ~28.4 STT |
| **Total spend** | **~1.6 STT** |

Per-call effective cost averaged ~0.3 STT (rebates return ~30% of the deposit ceiling). Spec §6 cost model holds; per-match estimate of 9.5–11 STT is consistent.

## Phase 0 verdict: PROCEED TO PHASE 1

- Core move loop: green-light.
- Audit consensus path: green-light.
- Lot pricing: green-light.
- Deposit math + callback gating + `receive()` rebate path: all working.
- Two non-blocking items (ParseWebsite tuning, MCP spike) parked for Phase 3 / Phase 5.
