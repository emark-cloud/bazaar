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

## Deploy (Ormi / Somnia subgraph hosting)

The build is verified; only the upload step remains. Somnia's subgraph hosting is Ormi —
verified endpoints below (per docs.somnia.network → Ormi Subgraph).

1. Create an account at **https://subgraph.somnia.network/** and copy your **deploy key**
   (the "key" icon in the left nav). Export it (it's secret — keep it out of git):

   ```bash
   export SOMNIA_SUBGRAPH_DEPLOY_KEY=<your-key>   # or put it in indexer/.env (gitignored)
   ```

2. Deploy (no `graph create` needed — Ormi registers on first deploy):

   ```bash
   pnpm --filter bazaar-indexer deploy
   # expands to:
   # graph deploy bazaar subgraph.yaml \
   #   --node https://api.subgraph.somnia.network/deploy \
   #   --ipfs https://api.subgraph.somnia.network/ipfs \
   #   --deploy-key $SOMNIA_SUBGRAPH_DEPLOY_KEY --version-label v0.0.1
   ```

3. Ormi returns a GraphQL query URL (shown on the dashboard / the "URL" button). Point the
   frontend at it: set `VITE_SUBGRAPH_URL=<that url>` and rebuild (see `frontend/.env.example`).

The `network: somnia-testnet` slug in `subgraph.yaml` is already the value Somnia/Ormi expects
(confirmed against their `graph init --network somnia-testnet` docs) — no change needed.

Ormi indexes on their own (archive) infrastructure, so the slow-public-RPC full-sync problem we
hit with the local graph-node (see below) does not apply — their node backfills the full range.

### Local test against a graph-node container

A working `docker/docker-compose.yml` (graph-node v0.35.1 + IPFS + Postgres) is included,
pre-wired to the Somnia testnet RPC. Verified end-to-end: graph-node connects
(`network_version: 50312`), decodes real Bazaar events, and serves them over GraphQL.

```bash
docker compose -f docker/docker-compose.yml up -d        # graph-node + IPFS + postgres
pnpm exec graph create --node http://localhost:8020 bazaar
pnpm exec graph deploy --node http://localhost:8020 --ipfs http://localhost:5001 \
      --version-label v0.0.1 bazaar subgraph.yaml          # NOTE: source manifest, not build/
```

GraphQL then serves at `http://localhost:8000/subgraphs/name/bazaar`. Point the frontend at it
with `VITE_SUBGRAPH_URL=http://localhost:8000/subgraphs/name/bazaar` (see `frontend/.env.example`).

**Two gotchas worth knowing (both handled in the compose file / commands above):**
- **Deploy the source `subgraph.yaml`, not `build/subgraph.yaml`** — the latter references compiled
  `.wasm` and makes the CLI try to compile them as mappings (it crashes).
- **Sync speed is RPC-bound.** Somnia's public RPC answers `eth_getLogs` in ~10 s per 1000-block
  window, so a full sync from the pinned start blocks (~4.8M blocks behind head) takes many hours.
  graph-node does *not* need full sync to serve data — it serves each entity as soon as it passes
  that block. For a fast local check, temporarily raise every `startBlock` to just before the
  cluster you care about (e.g. `392730000` for the Phase-3/4 Match #100 + audit cluster) and entities
  appear within ~1–2 minutes. (WSL2 note: the compose file pins explicit DNS + a host entry because
  Docker's embedded resolver intermittently fails to resolve the RPC host, which stalls the ingestor.)

The pinned `startBlock`s assume an archive RPC that can serve the full range (Ormi's). Against a
slow public RPC, raise them as above for local smoke tests.

## Notes

- `startBlock`s are tuned to where each contract first emitted live data on Shannon. They can be safely lowered to `392455000` (the chain block when Phase 0 spikes started) at the cost of re-indexing the empty range.
- `Match.openedTx` and `Move.tx` are deliberately stored so the frontend can produce direct explorer links per event.
