# TODO — Bazaar execution tracker

Companion to `CLAUDE.md` and the plan at `/home/emark/.claude/plans/i-want-to-build-fluffy-crab.md`.
Check items off as they ship. A phase is done only when its **demo artifact** runs end-to-end on testnet.

---

## Setup (day 1, parallelizable with Phase 0)

- [ ] Initialize git repo at `/home/emark/bazaar/`; first commit with the three specs + CLAUDE.md + TODO.md
- [ ] `pnpm-workspace.yaml` + root `package.json` with workspaces: `contracts`, `frontend`, `indexer`, `starter-kit`
- [ ] `contracts/` — `forge init --no-git`; commit `foundry.toml` with Solidity 0.8.30 (matches reactivity-contracts target)
- [ ] `frontend/` — `pnpm create vite frontend --template react-ts`; install viem + Tailwind
- [ ] `.env.example` at root (locked after Phase 0.1)
- [ ] Create funding wallet; record address; export private key to `.env` (gitignored)

## Phase 0 — verification spikes (days 1–2, blocking)

Each spike lives in `contracts/script/phase0/`. Capture stdout transcripts and on-chain tx links inline.

- [ ] **0.1 Endpoints** — hit both candidate testnet RPCs and both Agent Explorer URLs (resources.md §1.1); lock the working set into `.env.example`
- [ ] **0.2 Real agent IDs** — pull live IDs for LLM Inference, JSON API Request, LLM Parse Website from the Agent Explorer; commit to `contracts/src/lib/AgentIds.sol`
- [ ] **0.3 STT funding** — request testnet STT in Somnia Discord `#dev-chat` **with a Bazaar pitch** (resources §7). Target: 600 STT + 32 STT for scheduler. Faucet is a top-up only.
- [x] **0.4 `MoveDecider` spike** — `inferChat` returned byte-identical `"OFFER|lot=1|side=BUY|price=10"` across the subcommittee under `Majority`. **Determinism confirmed.**
- [x] **0.4a Determinism fallback decision** — **NOT INVOKED** (0.4 succeeded). Spec §3.2 Majority loop stands verbatim.
- [x] **0.5 JSON API spike** — `fetchUint` returned SOL-USD = $85.61 (scaled by 10²). Deposit math correct.
- [x] **0.6 `inferString` spike** — `Threshold 5/3`, returned `"clean"` (4 cleans, 0 suspects). Audit consensus path works.
- [ ] **0.7 `inferToolsChat` MCP spike** — DEFERRED (needs a public MCP server URL; not on Phase-1 critical path; ranked #2 in cut order)
- [ ] **0.8 Reactivity spike** — deferred until ≥35 STT (needs 32 STT lock); not Phase-1 blocking
- [ ] **0.9 VRF spike** — deferred until Phase 3 (AuditCouncil); not Phase-1 blocking
- [x] ParseWebsite — SOLVED. Working recipe: direct URL on `simple.wikipedia.org`-class small pages, `resolveUrl=false`, `numPages=1`, `confidenceThreshold≤30`. Returned `299792` km/s for speed of light. **Critical:** Parse Website is non-deterministic (temp 0.7, top_p 0.8) — Phase 3 AuditCouncil must aggregate via `Threshold` consensus, not `Majority`.
- [x] **Gate check:** core architecture (move loop, audit verdicts, lot pricing) verified ✓ — proceed to Phase 1

## Phase 1 — Arena core, exhibition only (days 3–6)

- [ ] `contracts/src/interfaces/` — copy verified `Request`/`Response`/`ConsensusType`/`ResponseStatus` structs once; import everywhere
- [ ] `contracts/src/lib/AgentPlatformBase.sol` — shared base: `platform` immutable, deposit helper, callback gate modifier, `pendingRequests` mapping, `receive() external payable {}`
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

- [ ] `contracts/src/AuditCouncil.sol` inheriting `VRFV2PlusWrapperConsumerBase` (Chainlink wrapper, paid in native STT); fund with LINK-equivalent native STT per `getRequestPrice()`
- [ ] Hook from `Arena.audited` after settlement
- [ ] Step 1: `requestRandomness()` for K=3 auditor seats
- [ ] Step 2: `fulfillRandomWords` picks K auditors from `AgentRegistry` (exclude match competitors)
- [ ] Step 3: per auditor → `createAdvancedRequest` with `inferString` + `allowedValues=["clean","suspect"]`, `Threshold` consensus, subcommittee 5 / threshold 3
- [ ] Step 4: 2 lots cross-checked with `LLM Parse Website` against the JSON API value
- [ ] Step 5: quorum — 2-of-3 `suspect` → `Treasury.freezeMatch()`; else finalize
- [ ] Appeal window timeout — fail-open to `clean` for liveness; verdict log stays on-chain
- [ ] Forge tests — quorum logic; freeze path; competitor-exclusion in auditor selection
- [ ] Deploy `AuditCouncil` to testnet; wire to `Arena` + `Treasury`
- [ ] **Demo artifact:** induced-bad-data test produces `suspect` verdict and freezes a match; clean match passes audit

## Phase 4 — LeagueScheduler (day 11)

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
- [ ] `TraceWaterfall` + `ReceiptLink` — the chain-is-always-one-toggle-away layer; links to `receipts.testnet.agents.somnia.host?requestId=<id>`
- [ ] `LadderPodium` + `LadderRow`, `SeasonFundPanel`, `AgentProfileHeader` + `EloChart`, `MintFlow` + `StrategyPromptEditor`
- [ ] Chain layer: viem clients, `watchContractEvent` for live updates, contract write helpers
- [ ] 5 screens wired: Hub, Live Match, Ladder, Agent Profile, Mint
- [ ] Settlement-beat motion sequence; coalition-formed connecting element; verify against design.md §4
- [ ] Test at 1920×1080 desktop primary; tablet + mobile reflow per design.md §5
- [ ] Respect `prefers-reduced-motion`
- [ ] Deploy hosted frontend (Vercel / Netlify); record public URL

### Indexer + starter-kit track

- [ ] `indexer/subgraph.yaml` + `schema.graphql` — index `MatchOpened`, `MoveMade`, `MoveDefaulted`, `MoveRejected`, `CoalitionFormed`, `MatchSettled`, `EloUpdated`, `AuditVerdict`, `Payout`
- [ ] Ormi mappings; deploy subgraph; record query URL
- [ ] `starter-kit/template/` — `persona/strategy.md`, `contracts/StrategyHooks.sol` + interfaces, `scripts/{mint,fund,enter}.ts`, `test/exhibition.test.ts`, `.env.example`, `README.md`
- [ ] `starter-kit/bin/` — `create-somnia-agent` CLI
- [ ] Publish to npm (or commit ready-to-publish state); verify the 5-minute quickstart end-to-end: mint → fund → enter → exhibition match

## Phase 6 — Record + harden + submit (days 16–18)

- [ ] Capture 3 real-stakes seasons + 1 exhibition match unattended; archive tx hashes, indexer snapshots, receipt IDs, stdout transcripts → `docs/RECORDED_RUNS.md`
- [ ] `docs/TECHNICAL.md` — "How Bazaar uses the Agentic L1": `createRequest`/callback flows, `Majority` vs `Threshold` choices, failure-mode table (verbatim from `bazaar.md` §7), the autonomy argument, the determinism-fallback decision from Phase 0.4a (if invoked)
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
