# CLAUDE.md — Bazaar repo guide

Read this first. The plan at `/home/emark/.claude/plans/i-want-to-build-fluffy-crab.md` is the source of truth for what to build and in what order. `TODO.md` in this folder tracks execution status.

## What this is

**Bazaar** — an autonomous on-chain agent marketplace for the **Somnia Agentathon**. AI agents owned by smart contracts negotiate and auction over lots whose true worth is set by live real-world data. Built natively on Somnia's agentic L1: the contract is the auctioneer, escrow, and referee; every negotiation move is a consensus-verified on-chain LLM call.

**Deadline:** 2026-06-11.
**Doubles as:** portfolio piece for the Somnia Demo Engineer role.

## Specs (already authored, do not re-derive)

- `bazaar.md` — full architecture spec v2. The contract topology, the negotiation game, cost model, failure-mode table. The bible.
- `design.md` — frontend design system: colors, sigils, the four-region Live Match grid, motion spec, component inventory.
- `resources.md` — verified Somnia resources, Tier-1 reading list, Phase-0 verification checklist, known doc contradictions.

When in doubt, re-read these — they were authored after thorough research.

## Locked decisions (do not re-litigate)

| | |
|---|---|
| Stack | Foundry + React/Vite + viem |
| Layout | pnpm workspaces monorepo |
| Indexer | Ormi subgraph |
| Scheduler | On-chain Reactivity (`@somnia-chain/reactivity-contracts`) |
| Audit randomness | Chainlink VRF v2.5 (Protofire wrapper) |
| Network | Testnet first (Shannon, chain 50312); mainnet only if stable |
| Move consensus | `Majority`, deterministic `inferChat` |
| Audit consensus | `Threshold` via `createAdvancedRequest` |

Platform contract addresses (verified live 2026-05-25):
- Testnet: `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776`
- Mainnet: `0x5E5205CF39E766118C01636bED000A54D93163E6`

## Repo layout

```
contracts/        Foundry — agent platform integration, Arena, Registry, Treasury, AuditCouncil, LeagueScheduler
frontend/         React/Vite + viem — the 5-screen Arena per design.md
indexer/          Ormi subgraph — schema + mappings
starter-kit/      `create-somnia-agent` scaffold + CLI
docs/             RECORDED_RUNS.md, TECHNICAL.md, VIDEO_SCRIPT.md
```

Full layout in the plan file. Phase-0 verification spikes live under `contracts/script/phase0/`.

## Four non-negotiable Somnia rules (memorize these)

Violations cause silent timeouts or stuck funds. Every requester contract inherits `contracts/src/lib/AgentPlatformBase.sol` which bakes in #2–#4.

1. **Deposit math:** `msg.value = getRequestDeposit() + perAgentPrice × subcommitteeSize`. The floor alone sets `perAgentBudget=0` → runners skip → timeout.
2. **`receive() external payable {}`** on every requester (rebate target). Missing → `NativeTransferFailed` → stuck funds.
3. **Gate every callback:** `require(msg.sender == platform)` + `pendingRequests` mapping. Callback is `external`.
4. **Decode safely:** check `status == Success` AND `responses.length > 0` before `abi.decode(responses[0].result, ...)`.

Plus: Reactivity subscriptions must filter on `eventTopics` / `origin` / `emitter` (no wildcards) and the owner contract needs ≥32 STT held to pay per-callback gas.

## Per-agent prices (testnet defaults, subcommittee 3)

| Agent | Per-agent price | Practical `msg.value` |
|---|---|---|
| JSON API Request | 0.03 STT | 0.12 STT |
| LLM Inference | 0.07 STT | 0.24 STT |
| LLM Parse Website | 0.10 STT | 0.33 STT |

Per-match cost (4 agents × 5 rounds): ≈9.5–11 STT. Plan a 600 STT testnet budget + 32 STT locked in `LeagueScheduler`.

## Phase status (keep current)

- [ ] Phase 0 — verification spikes + STT funding (gates everything)
- [ ] Phase 1 — Arena core, exhibition only
- [ ] Phase 2 — Economics (Treasury, real stakes)
- [ ] Phase 3 — AuditCouncil (VRF + Threshold inferString + Parse Website)
- [ ] Phase 4 — LeagueScheduler (on-chain Reactivity)
- [ ] Phase 5 — Frontend, indexer, starter kit (parallel)
- [ ] Phase 6 — Record runs, technical writeup, video, submit

Detailed checklist in `TODO.md`. When a phase completes, update both files.

## Things to never do

- Skip Phase 0 verification spikes. They gate the architecture.
- Cut scope unsolicited — full-spec was a deliberate choice. Cut order is in the plan file's "Risks" section if the timeline slips.
- Assume agent IDs from the spec. The docs hard-code placeholders; pull live from `agents.testnet.somnia.network`.
- Forget the `Majority` determinism fallback path (`Threshold` + canonical selector) if Phase-0 spike #3 fails.

## Where to find things

- The pitch line: `bazaar.md` §12.
- Failure-mode handling: `bazaar.md` §7 — copy verbatim into `docs/TECHNICAL.md`.
- The canonical "hello world" contract: `bazaar.md` §5 — base `MoveDecider.sol` on this.
- Design tokens (colors, typography, sigils, motion): `design.md` §1–§4.
- Receipt service URLs: `resources.md` §4.3.
- Phase-0 verification checklist: `resources.md` §8.
