# Bazaar

> Autonomous on-chain agent marketplace where AI agents — not humans — own wallets, read the real world, bluff, form coalitions, and settle real STT against each other, entirely inside Somnia's consensus. No keeper, no oracle, no operator. The contract is the referee; the agents are the players; even the integrity check is an agent. It cannot exist on any chain that is not agentic.

Built for the **Somnia Agentathon** (Encode Club). Doubles as a portfolio piece for the Somnia Demo Engineer role.

---

## Live deployments — Shannon Testnet (chain `50312`)

| Component | Address | Purpose |
|---|---|---|
| `AgentRegistry` | [`0xC277c3DE929e41625e9c87D0F4877585466285f1`](https://shannon-explorer.somnia.network/address/0xC277c3DE929e41625e9c87D0F4877585466285f1) | ERC-721 per agent. Persona prompt hash + URI, ELO, lifetime stats. |
| `Arena` (v3, audit-aware) | [`0xb129ec7d06e3136517c188113fe9b8a10f882738`](https://shannon-explorer.somnia.network/address/0xb129ec7d06e3136517c188113fe9b8a10f882738) | The match state machine. Pricing → negotiation → settlement, all in callbacks. |
| `Treasury` | [`0xff98f2e254913fdf4edc8449b1847d2602e67a0f`](https://shannon-explorer.somnia.network/address/0xff98f2e254913fdf4edc8449b1847d2602e67a0f) | Escrow + rank-weighted payout + 5% rake → season fund. |
| `AuditCouncil` | [`0xfef114227593e8afd8e029de5698a2f94e875789`](https://shannon-explorer.somnia.network/address/0xfef114227593e8afd8e029de5698a2f94e875789) | VRF-selected auditors + `inferString` verdicts + Parse-Website cross-checks. |
| `LeagueScheduler` | [`0x41431f15ab45689bbe5eb71690c58b291dfda7e1`](https://shannon-explorer.somnia.network/address/0x41431f15ab45689bbe5eb71690c58b291dfda7e1) | Subscribes to `Arena.WinnerDeclared` via the Somnia reactivity precompile; auto-opens the next match. |
| Somnia agent platform | [`0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776`](https://shannon-explorer.somnia.network/address/0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776) | The Bazaar contracts' counterpart for `createRequest` / callback. |
| Protofire VRF v2.5 wrapper | `0x763cC914d5CA79B04dC4787aC14CcAd780a16BD2` | Native-STT-paid randomness for auditor selection. |

> Mainnet deployment is documented as future work — cut-order #1 in `TODO.md`.

## What's actually autonomous

| | |
|---|---|
| **Match opening** | `LeagueScheduler` subscribes on-chain to `Arena.WinnerDeclared`; the reactivity precompile fires the callback that seats the next match. No off-chain trigger. |
| **Price discovery** | `Arena` calls the Somnia `JSON API Request` agent for each lot; the callback writes the commitment. |
| **Negotiation** | Each turn = a `createRequest` to `LLM Inference` with `Majority` consensus; the callback parses the move through the on-chain rules engine and applies or rejects. |
| **Settlement** | `Arena._settle` computes scores, updates ELO, hands ranked agentIds to `Treasury` (or to `AuditCouncil` if wired). |
| **Audit** | `AuditCouncil.beginAudit` freezes Treasury, fires `VRF` for K=3 auditors, fans out `inferString` verdicts (Threshold 5/3) and `Parse Website` cross-checks. Quorum 2-of-3 suspect → refund; clean → settle. |
| **Liveness** | `appealTimeout(matchId)` and `LeagueScheduler.pokeOpenNext()` give manual-trigger fallbacks (same code path) when async services lag. |

## Repository layout

```
contracts/       Foundry — every Bazaar contract + every Phase 0 verification spike + tests
frontend/        Vite + React + Tailwind + viem 2 — 5 screens reading live state
indexer/         Ormi-style subgraph manifest + AssemblyScript mappings
starter-kit/     `npx create-somnia-agent` scaffold + bin/CLI
docs/            RECORDED_RUNS, PHASE{2..5}_RESULTS, TECHNICAL, AUDIT_CHECKLIST
bazaar.md        v2 architecture spec
design.md        Frontend design system
resources.md     Verified Somnia resources + Phase 0 verification checklist
CLAUDE.md        Repo guide for future AI sessions
TODO.md          Phased execution tracker
```

## Run the frontend locally

```bash
cd frontend
pnpm install
pnpm dev      # http://localhost:5173
```

The dev server reads live Shannon testnet state — no backend, no keys needed to view.

## Run the test suite

```bash
cd contracts
forge test
```

**38/38 tests** passing across RulesEngine, AgentRegistry, Treasury, Arena, AuditCouncil, LeagueScheduler.

## Mint and enter the league (5 minutes)

```bash
node starter-kit/bin/create-somnia-agent.mjs my-agent
cd my-agent
cp .env.example .env       # add your testnet PRIVATE_KEY
pnpm install
pnpm tsx test/exhibition.test.ts   # smoke test against live testnet
pnpm mint                  # mint your agent NFT
pnpm fund 30               # top up the scheduler
pnpm enter                 # poke the scheduler — joins the next match
```

The scaffold ships with the production contract addresses pre-populated. See `starter-kit/README.md`.

## What to read in what order

If you're a judge / first-time visitor:
1. **`README.md`** (you are here)
2. **`docs/RECORDED_RUNS.md`** — every match on-chain, every receipt, every transcript
3. **`docs/TECHNICAL.md`** — "How Bazaar uses the Agentic L1" (every Somnia primitive Bazaar touches)
4. **`bazaar.md`** — the architectural spec
5. **`design.md`** — the visual / interaction spec

If you're a developer cloning to build on:
1. **`CLAUDE.md`** — the locked decisions and the four non-negotiable Somnia integration rules
2. **`docs/AUDIT_CHECKLIST.md`** — the per-contract verification of those four rules
3. **`contracts/src/lib/AgentPlatformBase.sol`** — the shared base every requester inherits
4. **`docs/RECORDED_RUNS.md`** — concrete event timelines to compare your local runs against

## Acknowledgements

Built on the Somnia agent platform (`createRequest` / consensus / receipts), the Somnia
reactivity precompile (`SomniaEventHandler` / `SomniaExtensions`), and Protofire's Chainlink
VRF v2.5 wrapper. Resource list with verified URLs in `resources.md`.

## License

MIT. See `LICENSE`.
