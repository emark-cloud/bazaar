# bazaar-indexer

Ormi subgraph that indexes the full lifecycle of every Bazaar match on Somnia Shannon testnet.

## What it indexes

| Source contract | Events handled |
|---|---|
| `Arena` | MatchOpened, LotPriced, NegotiationStarted, MoveRequested, MoveMade, MoveDefaulted, MoveRejected, CoalitionFormed, LotSold, LotRevealed, WinnerDeclared, AgentForfeited |
| `AgentRegistry` | AgentMinted, EloUpdated, AgentJoinableSet |
| `Treasury` | MatchEscrowed, MatchSettled, MatchRefunded, MatchFrozen/Unfrozen, PayoutSent/Failed, SeasonFundDrained |
| `AuditCouncil` | AuditStarted, AuditorsSelected, VerdictReceived, ParseCheckReceived, AuditFinalized, AuditTimedOut |
| `LeagueScheduler` | MatchScheduled, SchedulerStalled, SubscriptionEstablished |
| `AgentPlatform` (Somnia base) | RequestCreated, RequestFinalized — gives the `requestId → receipt` link the frontend trace layer needs |

## Why this exists

The frontend can run on `viem.watchContractEvent` alone for *live* updates, but a subgraph gives:
- O(1) queries for "all matches", "agent X's match history", "season fund history" without re-scanning the chain.
- A latency-derived `failureKind` (validation-fail vs agent-fail) on every PlatformRequest — the Phase 0 finding that <5 blocks-to-finalize means validation rejection, otherwise the agent itself failed.
- A `triggeredByReactive` flag on ScheduledMatch entries (sender = `0x0100` ⇒ the reactivity precompile actually delivered the callback, vs the manual `pokeOpenNext` fallback).

## Build status

`pnpm codegen` ✓ — types written to `generated/schema.ts` + per-contract bindings.
`pnpm build` ✓ — six WASM artefacts under `build/`, manifest at `build/subgraph.yaml`.

## Deploy (Ormi)

The build is verified; only the upload step remains. Two paths depending on how Ormi exposes
their graph-node:

### Path A — Ormi's hosted graph-node (most common)

```bash
pnpm exec graph deploy bazaar build/subgraph.yaml \
  --node   "$ORMI_GRAPH_NODE"     # e.g. https://api.ormi.somnia.network/deploy
  --ipfs   "$ORMI_IPFS"           # e.g. https://api.ormi.somnia.network/ipfs
  --deploy-key "$ORMI_DEPLOY_KEY" # from your Ormi dashboard
  --version-label v0.0.1
```

### Path B — Subgraph Studio (Graph Network)

```bash
pnpm exec graph deploy bazaar --studio --deploy-key "$STUDIO_DEPLOY_KEY"
```

### Verify the `network` slug

`subgraph.yaml` currently uses `network: somnia-testnet`. Ormi may expect a different slug
(e.g. `shannon-testnet` or `somnia`). The exact value comes from Ormi's "supported networks"
page or the deploy error if it's wrong — change once across all six data sources and re-build.

### Local test against a graph-node container

```bash
docker compose -f docker/docker-compose.yml up   # graph-node + IPFS + postgres
pnpm exec graph create   --node http://localhost:8020  bazaar
pnpm exec graph deploy   --node http://localhost:8020  --ipfs http://localhost:5001  bazaar
```

The included `subgraph.yaml` has `startBlock` values pinned to where each Bazaar contract first
emitted live data; expect indexing to catch up in a few minutes since the historical window is
small.

## Notes

- `startBlock`s are tuned to where each contract first emitted live data on Shannon. They can be safely lowered to `392455000` (the chain block when Phase 0 spikes started) at the cost of re-indexing the empty range.
- `Match.openedTx` and `Move.tx` are deliberately stored so the frontend can produce direct explorer links per event.
