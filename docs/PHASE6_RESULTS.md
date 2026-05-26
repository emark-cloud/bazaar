# Phase 6 — results

Phase 6 work-pass scope (per user direction): docs + recorded runs + repo hardening + subgraph build. **Excluded from this pass:** video script, frontend hosting, video recording, submission. Those are explicitly user-handled.

## What shipped

### Recorded runs (`docs/RECORDED_RUNS.md`)

Matches captured on Shannon testnet, each with deployments, tx hashes, event timelines, settlement math, and observations:

1. **Match #1** — Phase 1 first exhibition (4 agents × 2 rounds, 2 lots; opened block 392455795)
2. **Match #2** — Phase 2 first real-stakes (Treasury + rank-weighted payout + 5% rake)
3. **Match #3** — Phase 3 first audited real-stakes (Arena hands off to AuditCouncil → VRF + appealTimeout fail-open)
4. **Season 1** — Matches #101 → #102 → #103 — Phase 4 LeagueScheduler-driven, 2 reactive callbacks delivered live
5. **Season 2** — Match #104 — full-stack run with scheduler + audit integrated; the artifact that exercises every Bazaar primitive in one match

### Hardening docs

| File | Purpose |
|---|---|
| `README.md` | Pitch, live deployment table with explorer links, run instructions for frontend + tests + starter-kit, what-to-read guide |
| `LICENSE` | MIT |
| `docs/TECHNICAL.md` | "How Bazaar uses the Agentic L1" — 13 sections covering the integration pattern, the four Somnia rules, consensus choices, failure-mode table, exact selectors + costs, receipt-driven debugging, the Phase 0 discoveries, the autonomy argument |
| `docs/AUDIT_CHECKLIST.md` | Per-contract verification matrix for the four Somnia rules + reactivity filter + reentrancy + operator gates |

### Subgraph (`indexer/`)

`pnpm install` + `pnpm exec graph codegen` + `pnpm exec graph build` all complete cleanly. Six WASM artefacts produced; manifest at `build/subgraph.yaml`.

The actual deploy to Ormi requires their hosted graph-node URL + deploy key, which aren't in the repo. One-command deploy step (both Ormi and Subgraph-Studio paths) plus a local-graph-node fallback documented in `indexer/README.md`.

## Contract audit pass

`forge test` — **38 / 38 passing** across all six suites. No new tests added in Phase 6 (no Solidity changes); the rule-by-rule per-contract verification is in `docs/AUDIT_CHECKLIST.md`.

Key findings re-confirmed in the pass:
- Every requester contract (`Arena`, `AuditCouncil`) inherits `AgentPlatformBase` which encodes all four rules
- `Treasury` and `LeagueScheduler` aren't requesters but both have `receive() external payable {}` for native-STT receipt
- `LeagueScheduler` subscription filter pins `emitter: address(arena)` — no wildcard
- `nonReentrant` on every Treasury value-moving function; `.call{value}` failure routes to `seasonFund` (never reverts the whole settlement)
- AuditCouncil's `appealTimeout` and LeagueScheduler's `pokeOpenNext` are permissionless liveness escapes (intentional)

## Cost (Phase 6 work-pass)

| | |
|---|---|
| Match #104 (Phase 6 demo match) | 25 STT (scheduler-funded, recycled to NFT owner) + ~1 STT rake to season fund |
| Misc gas (setAuditCouncil, top-up, appealTimeout) | ~0.05 STT |
| Net spend | ~1 STT (the rake retained) |
| Deployer balance after Phase 6 | ~58 STT — comfortable for any further work |
| Season fund accumulated | 14 STT (5 × 1 STT real-stakes rakes + 5 STT carried from Match #2) |

## Open items handed back to the user

Per the explicit exclusions:

1. **Video walkthrough.** `docs/TECHNICAL.md` §3–§7 is the source material; settlement-beat capture per `design.md` §3.2 / §4 is the suggested first hero moment, coalition-formed connecting element per `design.md` §3.2 is the second.
2. **Frontend hosting.** `cd frontend && pnpm build` produces `dist/`; deploy to Vercel/Netlify and update `README.md` with the public URL.
3. **Submission.** Encode Club programme page + a one-paragraph pitch (line at the top of `README.md`).
4. **Subgraph deploy.** Build is verified; `indexer/README.md` has the one-line deploy command once Ormi credentials are in env.

## Submission-ready checklist

| | |
|---|---|
| Public GitHub repo | ✅ https://github.com/emark-cloud/bazaar |
| Live testnet deployment | ✅ (addresses in README + .env) |
| Recorded runs with tx hashes | ✅ docs/RECORDED_RUNS.md (5 matches + 2 seasons) |
| Technical writeup | ✅ docs/TECHNICAL.md |
| Audit checklist | ✅ docs/AUDIT_CHECKLIST.md |
| MIT license | ✅ |
| Starter kit | ✅ npx create-somnia-agent + template/ |
| Hosted frontend URL | ⏸ user-deferred |
| Demo video | ⏸ user-deferred |
| Subgraph live URL | ⏸ deploy gated on Ormi creds |
| Encode Club submission | ⏸ user-deferred |
