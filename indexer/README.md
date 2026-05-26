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

## Deploy (Ormi)

1. Set `network: somnia-testnet` correctly per Ormi's slug — verify before deploy.
2. `pnpm install`, then `pnpm codegen` to generate TypeScript bindings into `generated/`.
3. `pnpm build` to compile mappings.
4. `pnpm deploy` (set `ORMI_GRAPH_NODE` and `ORMI_IPFS` in your env).

## Notes

- `startBlock`s are tuned to where each contract first emitted live data on Shannon. They can be safely lowered to `392455000` (the chain block when Phase 0 spikes started) at the cost of re-indexing the empty range.
- `Match.openedTx` and `Move.tx` are deliberately stored so the frontend can produce direct explorer links per event.
