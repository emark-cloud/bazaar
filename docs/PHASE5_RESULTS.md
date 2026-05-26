# Phase 5 — results

Phase 5 ship gate: **a hosted Bazaar frontend that reads live state from Shannon testnet contracts, a deployable Ormi subgraph mapping every match event, and a one-shot `npx create-somnia-agent` scaffold.**

## What shipped

### Frontend (`/frontend`)

| | |
|---|---|
| Stack | Vite + React 18 + TypeScript + Tailwind 3 + viem 2 + react-router 6 |
| Design tokens | Per `design.md` §1 — colors, persona palettes, typography (Space Grotesk + Inter + JetBrains Mono), keyframes for `sigil-*`, `slide-up-in`, `flash-once`, `live-dot` |
| Screens | Hub, Live Match (`/live` + `/live/:id`), Ladder, Agents, AgentProfile, Mint |
| Chain layer | viem `publicClient` with fallback transport across both Shannon RPCs; hand-curated ABIs for Arena/Registry/Treasury/AuditCouncil/Scheduler |
| Trace layer | `TraceWaterfall` + `ReceiptLink` opening `agents.testnet.somnia.network/receipts/<requestId>` |

Run with `pnpm --filter bazaar-frontend dev` (default port 5173). Production build is 470 KB / 145 KB gzipped — fits one Vercel deploy slot, no node backend.

#### Sigils

Four geometric SVG marks (Hawk = diamond + stripes; Diplomat = interlocking circles; Quant = striped grid; Contrarian = circle with counter-cut), plus a generated mark for user-minted agents. Each tile carries a `state` prop driving the `sigil-pulse` / `sigil-thinking` / `sigil-strike` / `sigil-pulse(victory)` keyframes. Active agent panels in Live Match also get an `accent` ring per spec §3.2.

#### Live Match details

The four-region terminal grid (`260px | 1fr | 300px` columns + bottom strip):
- **Left** — `AgentPanel` per competitor with budget, score (computed client-side from revealed lot values), active-turn ring + "thinking" sigil.
- **Center** — `NegotiationStream` with transcript ↔ order-book toggle. Each move expands into the `TraceWaterfall`.
- **Right** — `LotCard` per lot showing sealed-vs-revealed value, current owner/coalition, standing offers.
- **Bottom** — move-kind tally strip.

Snapshots poll every 6 s, event log every 8 s. Audit state surfaces in the header bar when an audit is in flight (`AwaitingVRF` / `AwaitingResults` / `Finalized`).

### Indexer (`/indexer`)

Ormi-style subgraph manifest + AssemblyScript mappings across 6 data sources:

- **Arena** — every move, lot lifecycle, settlement, forfeit
- **AgentRegistry** — mints + ELO updates + joinable flips
- **Treasury** — escrow, payouts (per agent owner), refunds, season-fund flow
- **AuditCouncil** — full audit lifecycle including verdict tallies
- **LeagueScheduler** — every scheduled match flagged `triggeredByReactive` if `tx.from == 0x0100`
- **Agent platform** (Somnia base) — `RequestCreated` + `RequestFinalized` with `failureKind` derived from latency (validation-fail ≤ 5 blocks, agent-fail otherwise — Phase 0 finding)

Schema in `indexer/schema.graphql`. Manifest in `indexer/subgraph.yaml`. ABIs extracted from `forge build` output into `indexer/abis/*.json`. Deploy command stub: `pnpm deploy` against `ORMI_GRAPH_NODE` + `ORMI_IPFS` env vars.

### Starter kit (`/starter-kit`)

`npx create-somnia-agent <name>` scaffolds into `<name>/` with:
- `persona/strategy.md` — the "balanced opportunist" prompt template
- `contracts/StrategyHooks.sol` — optional deterministic guard-rails example
- `scripts/{mint,fund,enter}.ts` — each <60 lines, fully readable
- `test/exhibition.test.ts` — live-testnet smoke test
- `.env.example` pre-populated with the Phase 1–4 deployed addresses

CLI binary tested locally — produces a clean output dir, fills `package.json.name` from the dir name.

## Forge test count unchanged

Phase 5 added no Solidity — all contract behaviour is the same as Phase 4 ship. **38/38 forge tests** still pass.

## Open items deferred to Phase 6

- **Hosted deploy.** Vercel/Netlify endpoint for the frontend. Build is ready; only the upload step remains.
- **Ormi network slug.** `subgraph.yaml` uses `network: somnia-testnet` — verify the actual slug Ormi expects before deploy.
- **Strategy-prompt pinning.** Starter kit's `_lib.ts` writes a placeholder `bzaragent://` URI; real IPFS pinning (Pinata, Web3.Storage) is a follow-up.
- **Mint wallet connect in the UI.** The Mint screen previews the agent and shows the cast command; full WalletConnect/MetaMask flow is Phase 6 polish.
- **Subgraph `Agent.owner` updates on transfer.** Currently only set at mint — fine for the hackathon (no transfer flow), but the `Transfer` event handler should land before mainnet.

## Cost

No on-chain spend for Phase 5 — frontend reads only, no transactions. Subgraph deploy cost depends on Ormi's pricing model (likely free tier for testnet).
