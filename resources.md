# BAZAAR — Build Resources

**Companion to `Bazaar-Agentathon-Spec-v2.md`. Every resource needed to build the Bazaar autonomous agent marketplace for the Somnia Agentathon.**

Compiled May 2026 · all Somnia links verified against live documentation unless marked otherwise.

---

## 0. How to use this document

Resources are grouped by build phase. Tier 1 is the critical path — read every item before writing code. Tier 2+ is referenced as needed. Section 8 lists the **unverified items** that must be confirmed live in Phase 0 — do not skip it; one of them (conflicting network endpoints) will cost a day if missed.

---

## 1. ⚠️ Read first — known contradictions in the source material

Two things in Somnia's own documentation conflict. Resolve both before Phase 0.

### 1.1 Conflicting network endpoints

Different Somnia doc pages give different RPC and Agent Explorer URLs:

| Item | Value A (older pages, network-info) | Value B (agents quickstart) |
|---|---|---|
| Testnet RPC | `https://dream-rpc.somnia.network` | `https://api.infra.testnet.somnia.network` |
| Mainnet RPC | (various) | `https://api.infra.mainnet.somnia.network` |
| Agent Explorer (testnet) | `https://agents.somnia.network` | `https://agents.testnet.somnia.network` |
| Agent Explorer (mainnet) | — | `https://agents.somnia.network` |
| Faucet | docs faucet link | `https://testnet.somnia.network` |

**Action:** before Phase 0, confirm the live testnet RPC and the live Agent Explorer URL by actually hitting them. Use whichever resolves and serves current data. The agents quickstart is the more recent page, so Value B is the likely-correct set — but verify, do not assume.

### 1.2 "VRF" is Protofire Chainlink VRF, not a native Somnia primitive

Spec v2 §4.2 referred to "Somnia's native VRF" for audit-council auditor selection. There is **no native VRF**. Randomness on Somnia is **Protofire Chainlink VRF v2.5**, paid in native STT, integrated via the Chainlink wrapper contracts (addresses in §4 below). This changes the `AuditCouncil` design: it must inherit `VRFV2PlusWrapperConsumerBase`, request words, and select auditors in the `fulfillRandomWords` callback — an extra async hop. Budget for it. (Alternative for a simpler v1 build: seed auditor selection from an agent request's `responses[i].receipt` values or the consensus result hash — weaker than VRF but avoids the extra dependency. Decide in Phase 0.)

---

## 2. Tier 1 — Critical path (read every item before coding)

### 2.1 Somnia Agents — core mechanics

| Resource | URL | Why it matters for Bazaar |
|---|---|---|
| Invoking from Solidity | `docs.somnia.network/agents/invoking-agents/from-solidity` | The platform interface, `Request`/`Response` structs, `createRequest`, the fixed callback signature, the canonical example. The Phase 0 bible. |
| Agents Quickstart | `docs.somnia.network/agents/invoking-agents/quickstart` | Async invocation model, the network table, the Agent Explorer URLs. Note the §1.1 endpoint conflict originates here. |
| Gas Fees | `docs.somnia.network/agents/invoking-agents/gas-fees` | Two-pot deposit model, the `floor + perAgentPrice × subSize` formula, rebate logic, the `receive()` requirement. |
| Custom Consensus | `docs.somnia.network/agents/invoking-agents/custom-consensus` | `Majority` vs `Threshold`. Confirms deterministic LLM works under `Majority` (Bazaar's move loop) and shows `Threshold` aggregation (Bazaar's audit council). |
| Receipts | `docs.somnia.network/agents/invoking-agents/receipts` | Receipt format, the result-vs-receipt distinction, the receipt-service URLs (see §4). Underpins Bazaar's "verifiable trail" claim. |

### 2.2 Somnia Agents — the three base agents

| Resource | URL | Bazaar usage |
|---|---|---|
| LLM Inference | `docs.somnia.network/agents/base-agents/llm-inference` | `inferChat` = the negotiation move loop. `inferString` + `allowedValues` = audit verdicts. `inferToolsChat` = the MCP intel showcase. |
| JSON API Request | `docs.somnia.network/agents/base-agents/json-api-request` | `fetchUint`/`fetchInt`/`fetchString` price each lot. Dot-notation selectors; `decimals` scales floats to integers (×10^decimals). |
| LLM Parse Website | `docs.somnia.network/agents/base-agents/llm-parse-website` | `ExtractANumber`/`ExtractString` back the audit council's independent real-world cross-check. Injects `reasoning`/`answerable`/`confidence_score` into the receipt. |

### 2.3 The Agent Explorer — source of the real agent IDs

- Testnet: `agents.testnet.somnia.network` · Mainnet: `agents.somnia.network` (verify per §1.1)
- Browse agents, view methods/params, invoke from the browser, view receipts, and **generate Solidity + TypeScript code** per method.
- **This is the only source of the real agent IDs.** The docs hard-code placeholders. The one verified ID found in docs: LLM Parse Website agent ID `12875401142070969085` (confirm it is current).

---

## 3. Tier 2 — Scheduling, randomness, indexing

### 3.1 Reactivity — for `LeagueScheduler`

| Resource | URL | Notes |
|---|---|---|
| On-chain Reactivity | `docs.somnia.network/developer/reactivity/reactivity-onchain` | Core API, failure modes, gas-limit guidance. |
| Solidity on-chain Reactivity Tutorial | `docs.somnia.network/developer/reactivity/tutorials/solidity-on-chain-reactivity-tutorial` | Working `SomniaEventHandler` example. **Confirms: subscription owner must hold ≥32 native tokens; owner pays gas per callback; no wildcard subscriptions (filter needs eventTopics/origin/emitter).** |
| Cron subscriptions via SDK | `docs.somnia.network/developer/reactivity/tutorials/cron-subscriptions-via-sdk` | ⚠️ Not yet pulled. The cheaper SDK-cron alternative to on-chain reactivity. Read in Phase 0 to decide scheduler design. |
| Off-chain Reactivity | `docs.somnia.network/developer/reactivity/reactivity-offchain` | WebSocket client-side subscriptions — useful for the frontend's live updates. |
| npm package | `@somnia-chain/reactivity-contracts` | Provides `SomniaEventHandler`, `SomniaExtensions`. Targets Solidity `0.8.30`. |

### 3.2 Randomness — for `AuditCouncil` auditor selection

| Resource | URL / Address | Notes |
|---|---|---|
| Using Verifiable Randomness (VRF) | `docs.somnia.network/developer/building-dapps/oracles/using-verifiable-randomness-vrf` | Protofire Chainlink VRF v2.5, native-STT payment, full `RandomNumberConsumer` example. |
| VRF Wrapper (Testnet) | `0x763cC914d5CA79B04dC4787aC14CcAd780a16BD2` | `VRFV2PlusWrapper`. |
| VRF Wrapper (Mainnet) | `0x606b2B36516AB7479D1445Ec14B6B39B44901bf8` | `VRFV2PlusWrapper`. |
| LINK token (Testnet / Mainnet) | `0x30C75a2badF9b12733e831fcb5315C8f54e96f6d` / `0x0a4Db7035284566F6f676991ED418140dC01A2aa` | Not needed if paying in native STT. |
| npm package | `@chainlink/contracts@1.4.0` | `VRFV2PlusWrapperConsumerBase`, `VRFV2PlusClient`, `ConfirmedOwner`. |

### 3.3 Indexing — for the Bazaar indexer

| Resource | URL | Notes |
|---|---|---|
| Data Indexing and Querying | `docs.somnia.network/developer/building-dapps/data-indexing-and-querying` | Overview of indexing options. |
| Ormi Subgraph | `docs.somnia.network/developer/building-dapps/data-indexing-and-querying/ormi-subgraph` | Subgraph option — prefer over a hand-rolled indexer for a cleaner story and less code. |
| Protofire Subgraph | `docs.somnia.network/developer/building-dapps/data-indexing-and-querying/protofire-subgraph` | Alternative subgraph provider. |
| Listening to Events (WebSocket) | `docs.somnia.network/developer/building-dapps/data-indexing-and-querying/listening-to-blockchain-events-websocket` | For the frontend's real-time match view. |

---

## 4. Tier 3 — Network facts, addresses, endpoints

### 4.1 Networks

| Property | Mainnet | Testnet (Shannon) |
|---|---|---|
| Chain ID | `5031` | `50312` |
| Currency | SOMI | STT |
| RPC | `api.infra.mainnet.somnia.network` (verify §1.1) | `api.infra.testnet.somnia.network` (verify §1.1) |
| Explorer | `explorer.somnia.network` | `shannon-explorer.somnia.network` |
| SomniaAgents platform contract | `0x5E5205CF39E766118C01636bED000A54D93163E6` | `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` |

### 4.2 Agent platform parameters (defaults — operator-configurable)

| Parameter | Default |
|---|---|
| Subcommittee size | 3 |
| Threshold | 2 |
| Timeout | 15 minutes |
| `minPerAgentDeposit` (operations-reserve floor, per agent) | 0.01 STT |
| Per-agent price — JSON API Request | 0.03 STT |
| Per-agent price — LLM Inference | 0.07 STT |
| Per-agent price — LLM Parse Website | 0.10 STT |

### 4.3 Receipt services

| Network | Base URL |
|---|---|
| Testnet | `https://receipts.testnet.agents.somnia.host?requestId=<id>` |
| Mainnet | `https://receipts.mainnet.agents.somnia.host?requestId=<id>` |
| Human-readable | `https://agents.somnia.network/receipts/<id>` |

### 4.4 Critical contracts reference

- `docs.somnia.network/developer/smart-contracts` — the canonical list of critical Somnia contract addresses. Pull at build time; addresses can change.

---

## 5. Tier 4 — Standard tooling (you know these from zkFabric / GenLayer)

Linked for completeness; no deep pre-reading needed.

| Topic | URL |
|---|---|
| Deploy with Foundry | `docs.somnia.network/developer/development-frameworks/deploy-with-foundry` |
| Deploy with Hardhat | `docs.somnia.network/developer/development-frameworks/deploy-with-hardhat` |
| Local Testing and Forking | `docs.somnia.network/developer/development-frameworks/local-testing-and-forking` |
| Verifying via Explorer | `docs.somnia.network/developer/development-frameworks/verifying-via-explorer` |
| Debug Playbook | `docs.somnia.network/developer/development-frameworks/debug-playbook` |
| Using the Viem Library | `docs.somnia.network/developer/development-frameworks/using-the-viem-library` |
| JSON-RPC API | `docs.somnia.network/developer/json-rpc-api` |
| Gas differences vs Ethereum | `docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum` |
| Go-Live Checklist | `docs.somnia.network/developer/deployment-and-production/go-live-checklist` |
| Smart Contract Security 101 / Audit Checklist | `docs.somnia.network/developer/security/smart-contract-security-101` · `.../audit-checklist` |

**Frontend wallet auth** (pick one — all documented under `developer/building-dapps/wallet-integration-and-auth/`): MetaMask, ConnectKit, Privy, RainbowKit.

**Token / NFT contracts** (for the `AgentRegistry` ERC-721): `developer/building-dapps/tokens-and-nfts/create-erc721-nft-collections` and `.../using-native-somi-stt`.

**Example apps worth a skim** (patterns to borrow): `developer/building-dapps/example-applications/dao-smart-contract` (governance/escrow patterns), `.../building-a-simple-dex-on-somnia` (clearing/settlement patterns).

---

## 6. Hackathon, job, and ecosystem context

| Resource | URL | Notes |
|---|---|---|
| Somnia Agentathon (Encode Club) | `encodeclub.com/programmes/agentathon` | The programme page. JS-rendered — open in a browser; confirm the exact deadline and submission format. |
| Demo Engineer job posting | `jobs.ashbyhq.com/somnia/5c47b922-5bd8-49f2-a2a8-4c74014db491` | The hiring target. Re-read before writing the submission's video + writeup. |
| Developer's Guide to Somnia Agents | `blog.somnia.network` (Building on the Agentic L1 post) | The narrative framing of the agent model — useful for the technical writeup's voice. |
| Somnia main site | `somnia.network` | Positioning language ("the Agentic L1," "applications that can't exist anywhere else") — mirror it in the pitch. |
| Agentathon reference projects | the 9 cited GitHub repos | The calibre bar. Study `openDAIO/agents` for the multi-agent consensus pattern specifically. |

---

## 7. Getting testnet STT

You need a real STT budget — spec v2 §6 estimates **400–600 STT** for development, recorded runs, and demo headroom, **plus 32 STT** locked in `LeagueScheduler` if using on-chain reactivity. Sources:

1. **Faucet** — `testnet.somnia.network` (verify URL per §1.1). Note one faucet listing caps at 0.01 STT/day — far too little alone.
2. **Somnia Discord `#dev-chat`** — tag the DevRel team (the docs name `@emreyeth`) and request developer test tokens. **Do this early, and describe Bazaar when you ask** — given the hiring goal, getting Bazaar in front of DevRel before submission is a feature, not a chore.
3. **Somnia Developer Telegram** — alternative channel for the same request.
4. **Email** — send a brief project description + your GitHub profile (address on the network-info docs page).

Given the volume needed, the Discord/Telegram DevRel route is the realistic primary source; the faucet is a top-up.

---

## 8. Phase 0 verification checklist — unverified items

Everything below is **not yet confirmed** and must be resolved with a cheap spike before Phase 1 commits the architecture. This is the single most important section.

| # | Item | How to verify | Blocks |
|---|---|---|---|
| 1 | Live testnet RPC URL and Agent Explorer URL (§1.1 conflict) | Hit both candidate URLs; use whichever resolves with current data. | Everything. |
| 2 | Real agent IDs — LLM Inference, JSON API, LLM Parse Website | Read them off the live Agent Explorer; confirm the Parse Website ID `12875401142070969085` is current. | Every agent call. |
| 3 | `inferChat` determinism for a realistic Bazaar prompt | Spike: same long negotiation-state prompt, `Majority`, subcommittee 3 — confirm byte-identical results. If not, fall back to `Threshold` + a contract-chosen canonical move. | The core move loop. |
| 4 | `inferChat` payload size limit | Spike with a progressively larger `messages` array (arena state + growing log). | Round/log design. |
| 5 | `inferToolsChat` MCP path latency and completion | Spike one `inferToolsChat` call with an MCP server URL; confirm MCP tools execute within one invocation. | The intel showcase. |
| 6 | Reactivity economics: 32 STT lock + per-callback gas | Deploy the tutorial `SomniaEventHandler`; measure. Then read the SDK-cron page and decide on-chain vs cron. | `LeagueScheduler`. |
| 7 | VRF request price and callback gas on testnet | Deploy the `RandomNumberConsumer` example; call `getRequestPrice()`. Or decide on the receipt-hash fallback. | `AuditCouncil`. |
| 8 | Audit `Threshold` sizing | Confirm subcommittee 5 / threshold 3 works; price via `getAdvancedRequestDeposit(5) + 0.07 × 5`. | `AuditCouncil`. |
| 9 | Agentathon deadline + submission format | Open the Encode Club programme page in a browser. | The build plan calendar. |

---

## 9. Resource-to-component map

Quick index — which resources you need when building each Bazaar contract.

| Bazaar component | Primary resources |
|---|---|
| `MoveDecider` spike / `Arena` move loop | 2.1 from-solidity, 2.1 custom-consensus, 2.2 LLM Inference, 2.3 Explorer |
| Lot pricing in `Arena` | 2.2 JSON API Request, 2.1 gas-fees |
| `inferToolsChat` intel showcase | 2.2 LLM Inference (inferToolsChat section), MCP server of choice |
| `AuditCouncil` verdicts | 2.2 LLM Inference (inferString), 2.1 custom-consensus (Threshold), 2.2 LLM Parse Website |
| `AuditCouncil` auditor selection | 3.2 VRF (or receipt-hash fallback) |
| `LeagueScheduler` | 3.1 Reactivity (on-chain tutorial + SDK-cron) |
| `AgentRegistry` (ERC-721) | 5 ERC721 guide |
| `Treasury` | 5 native STT guide, 5 DAO/DEX example apps for escrow patterns |
| Indexer | 3.3 subgraph + WebSocket events |
| Arena frontend | 3.3 WebSocket events, 5 wallet auth, 4.3 receipt services |
| Verifiable-trail features | 2.1 receipts, 4.3 receipt services |
| Technical writeup / pitch | 6 developer's guide, 6 main site, 6 job posting |
