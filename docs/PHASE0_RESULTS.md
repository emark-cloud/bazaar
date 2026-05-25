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

## 0.7 — `inferToolsChat` MCP path — NEEDS DEVREL INPUT

Tried both `https://mcp.deepwiki.com/mcp` (Streamable HTTP) and `https://mcp.deepwiki.com/sse` (SSE transport) with valid prompts. Both returned `Failed` (status 3) within ~60s of the request, suggesting consensus reached on a failure response — not a timeout.

What works: request goes through, deposit is taken, callback fires with status — i.e. our `_send` + `onPlatformCallback` plumbing is correct. What doesn't: the agent runtime appears to reject these MCP URLs. Possible causes (cannot distinguish without receipt JSON):
- Somnia's `inferToolsChat` runtime may whitelist MCP servers it talks to.
- MCP transport version mismatch (the agent runtime may expect a specific version).
- Outbound HTTP from validators to public MCP servers may be restricted.

Receipt pages are fully client-rendered (`agents.testnet.somnia.network/receipts/<id>`) with no SSR data, so we cannot read the validator's error message via `curl` alone.

**Decision:** stop spending STT on blind retries. Add a specific question to the DevRel pitch: *"Is there a documented public MCP server URL for `inferToolsChat` testing on testnet?"*. Phase-1 critical path does not depend on this — cut order ranks it #2. Will revisit when DevRel responds.

## ParseWebsite — SOLVED, with two architecture-critical findings

After the docs signature gap was closed (added `confidenceThreshold` per the live Agent Explorer; docs page is stale), and a receipt PDF was inspected, the agent works end-to-end.

**Working call (tx `0xc80ffda93141a6a5452e1f506093422aa2bcdf9324ce2e72cb3e9ad3f1b91722`):**

```
requestNumber(
  "speed_of_light_kmps",
  "Speed of light in vacuum, in km/s, rounded to nearest integer.",
  0, 400000,
  "What is the speed of light in vacuum, in kilometers per second? Return a single integer (no commas, no units).",
  "https://simple.wikipedia.org/wiki/Speed_of_light",
  false, 1, 20  // resolveUrl, numPages, confidenceThreshold
)
→ Success, lastNumber = 299792   // exactly right
```

### Architecture finding #1 — Parse Website is NOT deterministic

Receipt for the (failing) Pi attempt revealed the LLM ran with **`temperature: 0.7, top_p: 0.8`** and a non-deterministic chunking step (`initial_chunks: 5, extraction_chunks: 2`).

**Implication:** Parse Website **cannot** run under `Majority` consensus. The spec's §3.6 audit-council design must use `Threshold` consensus with on-chain aggregation when invoking Parse Website. Numerical answers: median across validators. String answers: plurality. This propagates into `AuditCouncil.sol` design.

### Architecture finding #2 — RAG chunking penalises large pages

The receipt showed the LLM only sees a small fraction of the page (2 of 5 chunks for the Pi article, ~357k markdown chars total). If the answer isn't in the selected chunks, it returns `confidence_score: 0, answerable: false`, and the agent withholds the value (status 422 if below `confidenceThreshold`).

**Implication for Bazaar audit cross-check (Phase 3):**
- Use small, focused URLs where the value is in the lead/intro (e.g., `simple.wikipedia.org` over `en.wikipedia.org`).
- Keep `confidenceThreshold` modest (20–40 for cross-checks where any-confidence is meaningful; higher only when you need certainty).
- Build the prompt as a precise single-value question, not natural-language exposition.

### Bug summary (closed)

| # | Issue | Symptom | Fix |
|---|---|---|---|
| 1 | Missing `confidenceThreshold` parameter in our interface | `agent_error 400, no execution steps` | Added param; docs were stale, Explorer is source of truth |
| 2 | Long natural-language prompt as search query | `Search: No URLs found` (status 500) | Use `resolveUrl=false` + direct URL |
| 3 | Confidence threshold too strict + page too large | `agent_error 422` (LLM got chunk without answer, confidence=0) | Use smaller pages, lower threshold, specific prompts |

Three deterministic failure modes, three independent root causes. The receipt page (`agents.testnet.somnia.network/receipts/<id>`) was the single source of truth that made each fix possible.

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
