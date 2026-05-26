# Phase 1 — results

Phase 1 ship gate (per the plan and TODO): **one full exhibition match runs end-to-end on testnet, fully autonomous.** Achieved 2026-05-26 in Match #1 (`docs/RECORDED_RUNS.md`).

## Determinism precheck — re-validated at realistic payload size

Before building the move loop we revalidated the Phase 0 `inferChat` Majority finding at a payload size representative of mid-match state.

| Metric | Value |
|---|---|
| Total prompt (system + user) | 2,595 chars (~2.6 KB) |
| Validators returning byte-identical results | 2 of 3 (threshold met) |
| `byteIdentical` | **`true`** |
| Returned move | `OFFER\|lot=4\|side=BUY\|price=7` (sensible: Hawk had 8 STT left, bid 7 on new lot) |

The Majority loop ships as designed. **Open follow-up:** revalidate at >10 KB once the in-match negotiation log is added to the prompt (planned for Phase 2 prompt-engineering iteration).

## Contracts shipped

| Contract | Purpose | Address (testnet) |
|---|---|---|
| `AgentRegistry` | ERC-721 NFT-as-agent + ELO + discovery | `0xC277c3DE929e41625e9c87D0F4877585466285f1` |
| `Arena` | Match lifecycle + negotiation move loop | `0x369472358fd6946ffDE4a362b21B452bF3Df1eaA` |
| `lib/RulesEngine.sol` | Move string parser + validator | (library, linked into Arena) |
| `lib/AgentPlatformBase.sol` | Shared rules-1-4 base for any requester | (library, inherited) |

## Forge tests

13 tests passing across `RulesEngine.t.sol` + `AgentRegistry.t.sol` + `Arena.t.sol`. Arena tests drive a `MockPlatform` through full match lifecycles including the forfeit path, illegal-move path, and pricing-failure void path.

## Key implementation decision — balance-based deposit gating

The plan's spec §5 example uses `msg.value` to fund each `createRequest`. That works for external entry points but **fails for internal callbacks** (where msg.value=0) — and Arena's callbacks fan out further requests during a match. Patched `AgentPlatformBase._send` and `_sendAdvanced` to draw from `address(this).balance` instead. External entry points fund the contract via `msg.value` (e.g. `Arena.openExhibition` is payable and the caller provides match budget); internal callbacks draw from that balance.

This pattern propagates through Phase 2 (Treasury balance), Phase 3 (AuditCouncil balance), Phase 4 (LeagueScheduler balance) — every Bazaar requester contract pre-funds its outgoing calls.

## Validated Phase 0 architectural findings under real load

| Finding | Validated in Phase 1? |
|---|---|
| `inferChat` byte-identical under `Majority` (Phase 0.4) | ✓ 8 moves consensus-resolved, all decoded |
| `JSON API Request fetchUint` (Phase 0.5) | ✓ ETH-USD + SOL-USD both priced correctly |
| Deposit math: `floor + perAgent × subSize` | ✓ Phase 1 patch to balance-based works for nested callbacks |
| `receive() external payable` mandatory for rebates | ✓ inherited from `AgentPlatformBase` |

## Backlog for Phase 2 (see TODO.md)

- Negotiation log in prompt (and re-determinism check)
- Prompt iteration: "integer only, no units"
- Treasury (entry escrow, real-stakes payout, rake)
- ELO formula could be more nuanced; current ±24/12 is fine for demo
- Settlement scoring currently mixes lot value (cents-scaled int) with paid price (STT int) — fix unit conversion before real-stakes
