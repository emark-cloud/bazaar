# TODO — Bazaar execution tracker

Companion to `CLAUDE.md` and the plan at `/home/emark/.claude/plans/i-want-to-build-fluffy-crab.md`.
Check items off as they ship. A phase is done only when its **demo artifact** runs end-to-end on testnet.

---

## Setup (day 1, parallelizable with Phase 0)

- [x] Initialize git repo at `/home/emark/bazaar/`; first commit with the three specs + CLAUDE.md + TODO.md
- [x] `pnpm-workspace.yaml` + root `package.json` with workspaces: `contracts`, `frontend`, `indexer`, `starter-kit`
- [x] `contracts/` — `forge init --no-git`; commit `foundry.toml` with Solidity 0.8.30 (matches reactivity-contracts target). **Note:** `via_ir = true` required for `inferToolsChat`'s 6-tuple decode.
- [ ] `frontend/` — `pnpm create vite frontend --template react-ts`; install viem + Tailwind (cancelled in Phase 0; resume at Phase 5)
- [x] `.env.example` at root (locked after Phase 0.1)
- [x] Create funding wallet; record address; export private key to `.env` (gitignored)

## Phase 0 learnings to carry forward — read before starting any later phase

**Architecture-critical:**
- `inferChat` is **deterministic** under `Majority` for short prompts (Phase 0.4 confirmed byte-identical results across the subcommittee). **Open question** — revalidate determinism with realistic-length negotiation-log payloads (~10–30 KB messages) before Phase 1 ships the full move loop. If it diverges at scale, fall back to `Threshold` + canonical-move selector per `docs/TECHNICAL.md`.
- `LLM Parse Website` runs `Qwen3-30B-A3B` with **`temperature: 0.7, top_p: 0.8`** — outputs are **non-deterministic**. AuditCouncil (Phase 3) MUST use `Threshold` consensus and aggregate on-chain (median for `ExtractANumber`, plurality for `ExtractString`). Never use `Majority` for Parse Website.
- Parse Website returns a 4-field `structured_output`: `reasoning` (str), `answerable` (bool), `confidence_score` (int 0–100), `<user-named field>`. **Phase 3 audit must check `answerable=true` AND `confidence_score >= threshold`** before trusting the value, not just decode the raw result.
- `inferToolsChat` canonical signature: `inferToolsChat(string[],string[],string[],(string,string)[],uint256,bool)` selector `0xd0683905`. The `OnchainTool` struct is two strings (likely name+description) — Bazaar passes empty `[]` so field names don't matter, but the struct shape must be in the interface or the selector is wrong.
- `inferToolsChat` MCP path completes in **one invocation** (no `tool_calls` resume loop) — verified with `mcp.deepwiki.com/mcp`. Bazaar's intel showcase ships as a single call.

**Practical:**
- **The Agent Explorer (`agents.somnia.network/agent/<id>`) is the source of truth, not the docs page.** Every method's docs page has at least one stale or missing parameter. Always verify signatures on the Explorer when touching a new method.
- **Receipts pages (`agents.testnet.somnia.network/receipts/<id>`) are fully client-rendered.** `curl` cannot read them; only a real browser. For programmatic diagnostics use `platform.getRequest(uint256)` if we ever solve its 0x4ec726c7 revert (see open questions below).
- **`RequestCreated` event** indexes `requestId` (topic[1]) AND `agentId` (topic[2]) — indexer can filter per-agent-type cheaply. Payload bytes are in event `data`.
- **Per-request effective cost** averages **~0.3 STT** at default subcommittee 3 (~30% rebate vs deposit ceiling). Spec §6 cost model holds.
- **`forge script` simulating against testnet errors** with `NotActivated` when reading platform state — Somnia uses custom opcodes the simulator doesn't model. Use `cast call` for view reads, and `--skip-simulation --broadcast` for writes.
- **Validation-rejection vs agent-failure** both return `ResponseStatus.Failed` (3) — only the receipt distinguishes. Validation failures complete in ~4 blocks; agent failures take 30–120s. Phase 5 indexer should derive this from block latency or surface the receipt URL.

**Deferred Phase 0 spikes** (now prerequisites for later phases — addressed below):
- 0.8 Reactivity 32 STT lock + per-callback gas → Phase 4 prereq
- 0.9 VRF spike → Phase 3 prereq
- Top up STT (we're at 22 STT; need 32 lock + buffer for Phase 4 + many matches for Phase 6)

**Open questions** (not blocking but worth resolving when convenient):
- `platform.getRequest(uint256)` reverts with custom error `0x4ec726c7` for our finalized requests. Maybe requests are pruned post-finalization, or our struct decode is slightly off. Investigate before Phase 5 indexer if we want on-chain receipt access.
- Largest `inferChat` payload that still deterministic? (above)
- For Parse Website search-mode (`resolveUrl=true`): the prompt is used verbatim as the search query, so it must be a search-friendly keyword string, not a question. Bazaar doesn't use search mode, but worth knowing.

## Phase 1 learnings to carry forward — read before starting Phase 2+

**Architecture-critical:**
- **Balance-based deposit gating** is now in `AgentPlatformBase._send`/`_sendAdvanced` — they draw from `address(this).balance`, not `msg.value`. This is mandatory because the platform's callback into our contract has `msg.value=0`, but our contracts often need to fire follow-on requests from inside callbacks. Every Bazaar requester (Treasury, AuditCouncil, LeagueScheduler) inherits this automatically. **Implication for external callers:** they must `payable`-fund the contract with the full expected match/audit/scheduler-tick cost up front. Half-funded calls revert with `Underfunded(balance, required)`.
- **Settlement scoring has a unit mismatch in Phase 1** (Exhibition only, so harmless): lot value is feed-scaled (e.g. 209,331 = $2,093.31 with decimals=2), paid price is plain STT-int (e.g. 25). The current profit math subtracts them directly. **Phase 2 BLOCKER:** before Treasury introduces real STT transfers, normalize so both sides are in the same denomination — either scale paid price by feed decimals, or store a `lotValueScale` per match that converts cents → STT-equivalent. Otherwise real-stakes settlement will pay out wildly incorrect amounts.
- **Negotiation log not yet in prompt.** `Arena._buildPrompt` currently sends only `(budget + lot list)` as the user message. With no history of prior moves, all 4 agents bid their full budget on the same lot. Phase 2 must extend the prompt to include the full in-match move log, then **re-validate `inferChat` byte-identicality at the new payload size** (current 2.6 KB confirmed deterministic; full-match log probably pushes to 5–10 KB). Add the log progressively (round by round) and revalidate as it grows.
- **MatchKind.RealStakes is reserved but unwired.** `Arena.openExhibition` is the only entry point today. Phase 2 needs `openRealStakes(...)` that calls `Treasury.escrow(...)` for each agent's stake before the match opens. Stake collection comes from the agent NFT's **owner address** (not the NFT itself); operators-with-allowance pattern via `ERC20`-style approvals on STT, or pull from the agent owner's wallet via a signed permit (Phase 2 design decision).
- **Per-turn latency ~9 blocks (~9–10s).** Frontend (Phase 5) motion budget for the "thinking" state should be ≥10s. A full 4×5 match wall-clock ≈ 3.5 minutes. Real-stakes recorded seasons (3 matches) ≈ 12 minutes each, ~36 minutes total — plan recording sessions accordingly.

**Phase 2 prompt iteration (avoid burning STT on the same LLM mistakes):**
- Explicitly say *"integer only, no units, no commas, no underscores."* — Diplomat returned `price=10_STT` and was rejected. Cheaper to prevent than to handle as a default.
- Include 2–3 concrete OK / NOT-OK move examples in the system prompt.
- When the negotiation log lands, render it compactly (e.g. `R1.T0 Hawk OFFER lot=1 BUY 25`) to keep token count down.

**Phase 5 indexer notes from observed events:**
- Index `MoveRejected` and `MoveDefaulted` as separate event types — they have different semantics (rejected = LLM produced illegal move; defaulted = LLM call failed/timed out). Frontend's `MoveLogRow` uses both with different visual states.
- `MatchSettled(uint256 matchId indexed, uint256[] agentIds, int256[] scores, uint256 winnerAgentId)` — the dynamic-array decoding is non-trivial. Either add a separate `WinnerDeclared(matchId indexed, winnerAgentId indexed)` event for cheap indexing, or write a careful decoder. Frontend wants quick winner lookup.
- `scores` is `int256[]` — can be negative on forfeit. Indexer schema must use signed types; UI shows ±.
- Latency-based heuristic to surface in the UI: validation-fail completes in ~4 blocks, agent-fail takes 30–120s. Phase 0 noted this; Phase 1 confirmed: each successful `inferChat` move took ~9 blocks. So **anything finalizing in <5 blocks = validation failure; show as "request invalid" not "agent failed"**.

**Cost model validated:**
- Spec §6 estimated 9.5–11 STT per 4×5 match. Phase 1 Match #1 (4×2, 2 lots) burned ~2.5 STT — scaling to 4×5 × 4 lots gives ~10 STT, matches spec. Hold the model.
- Per-call effective cost ~0.3 STT (rebates return ~30% of deposit ceiling).
- For Phase 6 recorded seasons (3 real-stakes 4×5 matches + 1 exhibition): plan ~40 STT for agent platform fees alone, plus stake escrow (4 × 25 STT × 3 = 300 STT in stakes, recycled via payouts).

**Untested code path:** `Arena._advanceTurn` has a branch that calls `_toSettling` when all agents have forfeited. The current test suite doesn't cover this. Phase 2: add a test that forfeits all 4 agents in a 4-round match.

**Deferred from Phase 1 (won't block Phase 2 but accumulate as debt):**
- SELL-side moves: rules engine parses them, Arena rejects them. Decision needed: keep BUY-only auctions for narrative clarity, or implement SELL (more complex, more interesting). Recommend BUY-only through Phase 6; revisit post-submission.
- Coalition share parameter: parsed but settlement hard-codes 50/50. Phase 2 can wire share-aware payout if budget allows.
- Strategy hooks contract: AgentRegistry has no hooks pointer. Phase 5 starter-kit needs this (let advanced users add deterministic guardrails). Add `address strategyHooks` to the `Agent` struct in Phase 5, not earlier.

## Phase 2 learnings to carry forward — read before starting Phase 3+

**Strategy emerged after prompt v2:**
The negotiation log + per-lot `valueHint` + integer-only rules + format examples + score-objective text transformed agent behavior in Match #2. From Phase 1's "all 4 agents bid full budget on lot 1" to Phase 2's diverse strategic play (different lot targeting, min-increment counter-bids, 3 coalition attempts including 1 accepted, self-coalition rejection caught). **Keep these prompt invariants when iterating in Phase 3+.** Specifically:
- Negotiation log capped at last 32 entries (`_log[matchId]` storage) — sufficient for 5-round matches; revisit if rounds increase.
- `valueHint` per lot is what lets agents know "what number is sensible to bid" given the feed's natural scale. Without it, agents don't know whether to bid 50 or 5000.
- "integer only, no units, no commas, no underscores" + concrete OK/NOT-OK examples killed the unit-suffix LLM error from Phase 1.

**Architecture-critical:**
- `valueDivisor` per lot normalises feed-raw value → STT-int profit. Match #2 used `divisor=1` with `feedDecimals=0` (integer dollars). For larger numbers (e.g. BTC at $90,000), use a larger divisor so effective values stay in a reasonable bid range. Document each lot's divisor in `RECORDED_RUNS.md` alongside its feed.
- **Budget-vs-stake unit clarity is still messy** — `openRealStakes` uses `entryStake` (in wei) as the agent's `m.budget[i]`, so bids are checked against `25 ether = 25e18` while LLMs return small integers like `2001`. Works by accident in Phase 2 (any integer fits in 25e18). **Phase 3 task:** separate `bidBudget` (game units, e.g. 25) from `entryStake` (STT wei, e.g. 25e18). Otherwise agents could theoretically bid 1e18 and pass validation, breaking score math.
- **Tied-bid quirk:** `OFFER` at the same price as a standing offer parses OK but doesn't update state (no error, no displacement). Phase 3 decision: either reject as illegal (`OFFER must beat standing offer or be the first`), or leave as no-op. Recommend rejecting for clarity — `MoveRejected` makes the failure visible.
- **Coalition target is implicit:** the partner must have an open standing offer; the coalition binds to that lot. Multiple coalitions on the same lot will overwrite `L.coalitionPartner`. Phase 3: either enforce one-coalition-per-lot or extend to a list. Frontend (Phase 5) should visualise which lot a coalition binds to.
- **All-agents-forfeited path is still untested.** Code exists in `_advanceTurn → _toSettling` but no test covers it. Phase 3 forge test required.

**Treasury contract notes:**
- `Arena` is operator on Treasury via `setOperator`. **Phase 3 AuditCouncil also needs operator role** for `freezeMatch` / `unfreezeMatch`. Don't grant `settleMatch` permission to AuditCouncil — only Arena calls that.
- `LeagueScheduler` (Phase 4) does NOT need Treasury operator status — it goes through `Arena.openRealStakes` which forwards to Treasury.
- **Payout fallback to season fund** — if an NFT owner's `.call{value}` fails (e.g. contract that rejects ETH), the payout is added to `seasonFund` rather than getting stuck. This is good UX defence; document in the technical writeup.
- **Drain target:** `seasonFundRecipient` is settable by owner. For the season-end bonus to top of the ELO ladder (spec §3.5), Phase 5 should add a `distributeSeasonFund(uint256[] rankedAgentIds)` function with weighted distribution similar to per-match payout.

**Indexer additions for Phase 5:**
- Treasury events to index: `MatchEscrowed`, `MatchSettled` (Treasury's, namespace-collision with Arena's; index by event-emitter address), `MatchRefunded`, `MatchFrozen`, `MatchUnfrozen`, `PayoutSent` (per-owner — Profile page lifetime earnings), `PayoutFailed`, `SeasonFundDrained`.
- `WinnerDeclared(matchId indexed, winnerAgentId indexed, int256 score)` is now emitted from Arena alongside `MatchSettled` — index it for cheap "matches won by agent X" queries.

**Operating-funds separation:**
- Arena needs operating STT for `inferChat`/JSON API calls. `openRealStakes` accepts `msg.value = pot + extra`; the extra stays in `address(this).balance` and funds platform calls.
- For Phase 4 LeagueScheduler: the scheduler sends `pot + operating` to `Arena.openRealStakes` on each tick. Alternative: keep Arena pre-funded with a larger one-time operating reserve. **Phase 4 design decision** — pre-funded is simpler operationally; per-tick sends keep accounting cleaner.

**Cost tracking (post-Match #2):**
- Match #2 real-stakes cost ~10 STT operating + 5 STT rake retained = ~15 STT net (excluding pot recycling, which is owner-to-owner movement).
- Phase 6 plan: 3 real-stakes seasons × 3 matches = ~135 STT operating + ~45 STT rake. Budget ~200 STT for the recorded-runs phase.
- Current balance 177 STT comfortably covers Phase 3 + Phase 4 spike. May need a top-up before Phase 6 recordings.

**Untested-but-likely-fine paths to verify in Phase 3 tests:**
- `Treasury.refundMatch` via `Arena._handlePricing` failure on a RealStakes match (we tested it via unit test in `TreasuryTest.testRefundOnVoid`, but the integration path from Arena is untested on testnet).
- Forfeit penalty in real-stakes — currently `scores[i] -= int256(m.budget[i])` which is `25 ether` in real-stakes. That score number wildly dwarfs normal profit (~50–100). Forfeited agents will always rank last (which is what we want), but the math is unrealistic. Phase 3: cap forfeit penalty at some sane value like `entryStake / 1e18` or similar.

## Phase 0 — verification spikes (days 1–2, blocking)

Each spike lives in `contracts/script/phase0/`. Capture stdout transcripts and on-chain tx links inline.

- [x] **0.1 Endpoints** — `api.infra.testnet.somnia.network` locked as primary; chainId 50312 confirmed
- [x] **0.2 Real agent IDs** — in `contracts/src/lib/AgentIds.sol`
- [x] **0.3 STT funding (initial 30 STT)** — used ~7.6 STT for Phase 0; **need to top up before Phase 4** (32 STT scheduler lock + buffer)
- [x] **0.4 `MoveDecider` spike** — `inferChat` returned byte-identical `"OFFER|lot=1|side=BUY|price=10"` across the subcommittee under `Majority`. **Determinism confirmed.**
- [x] **0.4a Determinism fallback decision** — **NOT INVOKED** (0.4 succeeded). Spec §3.2 Majority loop stands verbatim.
- [x] **0.5 JSON API spike** — `fetchUint` returned SOL-USD = $85.61 (scaled by 10²). Deposit math correct.
- [x] **0.6 `inferString` spike** — `Threshold 5/3`, returned `"clean"` (4 cleans, 0 suspects). Audit consensus path works.
- [x] **0.7 `inferToolsChat` MCP spike** — SOLVED. Canonical selector `0xd0683905` discovered via raw-selector probing; struct is `(string,string)`. End-to-end test against `https://mcp.deepwiki.com/mcp` returned `"Solidity"` for `foundry-rs/foundry`'s primary language. MCP path completes in one invocation (no resume loop).
- [ ] **0.8 Reactivity spike** — deferred until ≥35 STT (needs 32 STT lock); not Phase-1 blocking
- [ ] **0.9 VRF spike** — deferred until Phase 3 (AuditCouncil); not Phase-1 blocking
- [x] ParseWebsite — SOLVED. Working recipe: direct URL on `simple.wikipedia.org`-class small pages, `resolveUrl=false`, `numPages=1`, `confidenceThreshold≤30`. Returned `299792` km/s for speed of light. **Critical:** Parse Website is non-deterministic (temp 0.7, top_p 0.8) — Phase 3 AuditCouncil must aggregate via `Threshold` consensus, not `Majority`.
- [x] **Gate check:** core architecture (move loop, audit verdicts, lot pricing) verified ✓ — proceed to Phase 1

## Phase 1 — Arena core, exhibition only (days 3–6)

- [x] `contracts/src/interfaces/` — `IAgentPlatform`, `ILlmAgent`, `IJsonApiAgent`, `IParseWebsiteAgent` all canonical (verified live)
- [x] `contracts/src/lib/AgentPlatformBase.sol` — built in Phase 0; rules 1–4 encoded; `_send` and `_sendAdvanced` helpers; `receive()`. Reuse as-is.
- [ ] **PRECHECK** — before Phase 1 negotiation loop ships, spike `inferChat` with a realistic-length prompt (full persona + arena state + 5-round log = ~10–20 KB messages). Confirm `byteIdentical=true` still holds. If not, switch to `Threshold` + lowest-keccak canonical selector inside `handleMove`.
- [ ] `contracts/src/AgentRegistry.sol` — ERC-721, persona pointer (content hash + URI), ELO ledger, discovery view functions (`listJoinableAgents`, `getAgent`)
- [ ] `contracts/src/Arena.sol` skeleton — states `Open → Pricing → Negotiating → Settling → Audited → Finalized`; storage for matches, turns, lots, holdings, coalitions
- [ ] Rules engine — parse structured move string (`OFFER|lot=X|side=BUY|price=Y` etc.); validate against game state; reject illegal
- [ ] Sealed lot values — commit `keccak256(value, salt)` on open; reveal at settlement; verify on-chain
- [ ] Negotiation turn loop — assemble `inferChat` payload → `createRequest` with correct deposit → `handleMove` callback gated and decoded safely → apply or default to PASS → emit `MoveMade` / `MoveDefaulted` / `MoveRejected`
- [ ] Three-strikes forfeit — agent defaulting 3 turns in a row scores `-stake`, match continues
- [ ] Settlement: reveal lot values, settle holdings + coalitions, compute scores, ELO update via `AgentRegistry`, emit `MatchSettled`
- [ ] Forge tests — rules engine (illegal moves rejected; PASS default; timeout default; coalition payoff; forfeit threshold)
- [ ] Deploy `AgentRegistry` + `Arena` to testnet; mint 4 default personas (Hawk / Diplomat / Quant / Contrarian) with strategy prompts
- [ ] **Demo artifact:** one full exhibition match runs end-to-end on testnet; transcript and tx hashes recorded in `docs/RECORDED_RUNS.md`

## Phase 2 — Economics (days 7–8)

- [ ] `contracts/src/Treasury.sol` — entry escrow, pot accounting, rank-weighted payout (winner-weighted curve), 5% rake → season fund, freeze window with appeal period
- [ ] `receive() external payable {}`; `nonReentrant` on payouts; checks-effects-interactions throughout
- [ ] `Arena` learns `MatchKind = {Exhibition, RealStakes}`; Exhibition bypasses Treasury
- [ ] Wire: `Arena.settle()` → `AgentRegistry.updateElo()` → `Treasury.payout()`
- [ ] Forge tests — payout math; rake split; reentrancy guard; freeze blocks payout; refund on void
- [ ] Deploy `Treasury` to testnet; wire into `Arena`
- [ ] **Demo artifact:** one real-stakes 4-agent match settles correctly with real STT moving

## Phase 3 — AuditCouncil (days 9–10)

**Prereqs from Phase 0:**
- [ ] **VRF spike (formerly Phase 0.9)** — deploy `RandomNumberConsumer` against Protofire VRF v2.5 wrapper (testnet `0x763cC914d5CA79B04dC4787aC14CcAd780a16BD2`); call `getRequestPrice()`; complete one `fulfillRandomWords` cycle. Confirms VRF cost model and confirms async-hop UX.

**Build:**
- [ ] `contracts/src/AuditCouncil.sol` inheriting `VRFV2PlusWrapperConsumerBase` (Chainlink wrapper, paid in native STT); fund with LINK-equivalent native STT per `getRequestPrice()`
- [ ] Hook from `Arena.audited` after settlement
- [ ] Step 1: `requestRandomness()` for K=3 auditor seats
- [ ] Step 2: `fulfillRandomWords` picks K auditors from `AgentRegistry` (exclude match competitors)
- [ ] Step 3: per auditor → `createAdvancedRequest` with `inferString` + `allowedValues=["clean","suspect"]`, `Threshold` consensus, subcommittee 5 / threshold 3
- [ ] Step 4: 2 lots cross-checked with `LLM Parse Website` against the JSON API value
  - **Use `Threshold` consensus** — Parse Website is non-deterministic (Phase 0 finding)
  - **On-chain aggregation:** for numeric (`ExtractANumber`) → median across validators; for string (`ExtractString`) → plurality. Encode helpers in `AuditCouncil.sol`.
  - **Parse Website call recipe:** direct URL only (`resolveUrl=false`), small focused page (e.g. `simple.wikipedia.org`-class), `numPages=1`, `confidenceThreshold=20–40`, single-value question prompt. Audit only accepts results where `answerable=true` AND `confidence_score >= confidenceThreshold` (decode all 4 fields, not just the value).
- [ ] Step 5: quorum — 2-of-3 `suspect` → `Treasury.freezeMatch()`; else finalize
- [ ] Appeal window timeout — fail-open to `clean` for liveness; verdict log stays on-chain
- [ ] Forge tests — quorum logic; freeze path; competitor-exclusion in auditor selection; numeric-median and plurality-string aggregators
- [ ] Deploy `AuditCouncil` to testnet; wire to `Arena` + `Treasury`
- [ ] **Demo artifact:** induced-bad-data test produces `suspect` verdict and freezes a match; clean match passes audit

## Phase 4 — LeagueScheduler (day 11)

**Prereqs:**
- [ ] **STT top-up** — current balance ~22 STT; need 50 STT to fund the scheduler (32 lock + per-callback gas). Ask DevRel again, this time with a live Phase 1+2 demo to point at.
- [ ] **Reactivity spike (formerly Phase 0.8)** — deploy tutorial `SomniaEventHandler`; **empirically confirm** the 32 STT owner-balance requirement; measure per-callback gas for a realistic `LeagueScheduler.openMatch` payload. Decide on-chain vs SDK cron based on measured cost. If on-chain > 0.1 STT/callback → fall back to SDK cron per the plan's cut order.

**Build:**
- [ ] `contracts/src/LeagueScheduler.sol` using `@somnia-chain/reactivity-contracts` (`SomniaEventHandler`)
- [ ] Subscribe to `Arena.MatchFinalized` with explicit `emitter = address(arena)` (no wildcards)
- [ ] Callback handler: pick highest-ranked joinable agents from `AgentRegistry`; deposit match funding from scheduler balance; call `Arena.openMatch()`
- [ ] Balance gate: emit `SchedulerStalled` if below threshold; existing matches finish; refill resumes
- [ ] Deploy `LeagueScheduler` to testnet; fund with 50 STT (32 lock + buffer)
- [ ] Create the on-chain subscription
- [ ] **Demo artifact:** unattended multi-match season runs (e.g., overnight) with zero human input

## Phase 5 — Surfaces (days 12–15, two parallel tracks)

### Frontend track

- [ ] Tailwind config — design.md §1.1 color tokens, §1.3 typography (Space Grotesk + Inter + JetBrains Mono), §1.4 form language
- [ ] 4 persona SVG sigils (Hawk / Diplomat / Quant / Contrarian) per design.md §2.1; check into `frontend/public/sigils/`
- [ ] `AppShell` (top bar + left icon rail)
- [ ] `SigilTile` with idle/thinking/acting/coalition/victory animation states (design.md §2.2)
- [ ] `AgentPanel`, `NegotiationStream` (Transcript + OrderBook toggle), `TranscriptLine`, `OrderBookRow`, `LotCard`, `MiniLadder` (FLIP reorder), `MoveLogRow`
- [ ] `TraceWaterfall` + `ReceiptLink` — the chain-is-always-one-toggle-away layer. **Correct receipt URL:** `https://agents.testnet.somnia.network/receipts/<id>` (the `receipts.testnet.agents.somnia.host` host returns 404; was deprecated). Receipts are JS-rendered, so the trace layer opens them via `target=_blank` rather than scraping content.
- [ ] `LadderPodium` + `LadderRow`, `SeasonFundPanel`, `AgentProfileHeader` + `EloChart`, `MintFlow` + `StrategyPromptEditor`
- [ ] Chain layer: viem clients, `watchContractEvent` for live updates, contract write helpers
- [ ] 5 screens wired: Hub, Live Match, Ladder, Agent Profile, Mint
- [ ] Settlement-beat motion sequence; coalition-formed connecting element; verify against design.md §4
- [ ] Test at 1920×1080 desktop primary; tablet + mobile reflow per design.md §5
- [ ] Respect `prefers-reduced-motion`
- [ ] Deploy hosted frontend (Vercel / Netlify); record public URL

### Indexer + starter-kit track

- [ ] `indexer/subgraph.yaml` + `schema.graphql` — index `MatchOpened`, `MoveMade`, `MoveDefaulted`, `MoveRejected`, `CoalitionFormed`, `MatchSettled`, `EloUpdated`, `AuditVerdict`, `Payout`
- [ ] Also index Somnia platform `RequestCreated` (topic[1]=requestId, topic[2]=agentId, data=payload+subcommittee) and `RequestFinalized` (requestId+status), filtered by `requester = our contracts`. Lets the frontend match each `MoveMade` to its `requestId` and receipt URL.
- [ ] Derive "validation-fail vs agent-fail" from finalization latency (fast = validation, slow = agent execution). Surface both flavours in `MoveLogRow` because the failure semantics are different.
- [ ] Ormi mappings; deploy subgraph; record query URL
- [ ] `starter-kit/template/` — `persona/strategy.md`, `contracts/StrategyHooks.sol` + interfaces, `scripts/{mint,fund,enter}.ts`, `test/exhibition.test.ts`, `.env.example`, `README.md`
- [ ] `starter-kit/bin/` — `create-somnia-agent` CLI
- [ ] Publish to npm (or commit ready-to-publish state); verify the 5-minute quickstart end-to-end: mint → fund → enter → exhibition match

## Phase 6 — Record + harden + submit (days 16–18)

- [ ] Capture 3 real-stakes seasons + 1 exhibition match unattended; archive tx hashes, indexer snapshots, receipt IDs, stdout transcripts → `docs/RECORDED_RUNS.md`
- [ ] `docs/TECHNICAL.md` — "How Bazaar uses the Agentic L1". Must cover:
  - `createRequest`/callback flows + the four non-negotiable Somnia rules
  - `Majority` (deterministic LLM) vs `Threshold` (Parse Website + audit verdicts) choices
  - Failure-mode table (verbatim from `bazaar.md` §7)
  - The autonomy argument
  - **Phase 0 discoveries section:** docs are stale; Agent Explorer is canonical; the `inferToolsChat` `OnchainTool` struct shape (selector `0xd0683905`, fields `(string,string)`) was reverse-engineered via raw-selector probing (link to `RawSelectorSpike.sol`); Parse Website non-determinism + the `confidence_score` gating recipe; receipt-driven debugging methodology
  - Determinism-fallback decision from Phase 0.4a (not invoked, but show the fallback selector for completeness)
- [ ] `docs/VIDEO_SCRIPT.md` — scripted walkthrough; settlement beat + coalition forming as the two hero captures
- [ ] Record video walkthrough; upload (YouTube / Loom)
- [ ] Frontend capture polish at 1920×1080
- [ ] `README.md` at repo root — one-paragraph pitch (from `bazaar.md` §12), live deployment addresses, hosted frontend URL, video link, starter-kit quickstart
- [ ] Final pass on every contract: deposit math; `receive()` present; callback gated; status check before decode; reactivity filter set
- [ ] Submit per Encode Club programme page (public GitHub repo, hosted frontend URL, demo video)
- [ ] Post-submission: DM Somnia DevRel with the submission link (hiring angle)

## Cut order if timeline slips (do not invoke unless behind on day 11)

1. Mainnet deployment → testnet only
2. `inferToolsChat` MCP intel showcase → keep `inferChat` core loop
3. `create-somnia-agent` npx CLI → template files in repo only, defer CLI
4. Ormi subgraph → WebSocket events only, in-memory replay
5. On-chain Reactivity → SDK cron path
6. Chainlink VRF → receipt-hash auditor selection

**Never cut:** Arena core, Treasury, full Live Match screen, trace layer, video walkthrough.
