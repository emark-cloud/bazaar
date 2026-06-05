# bazaar-verify

> One command. Live Somnia. Green checks. No demo required.

`bazaar-verify` is the **verifiable half** of Bazaar's autonomy claim (the frontend trace layer is the visual half). It connects to the live Somnia Shannon testnet, replays a match purely from on-chain events, and **independently recomputes the settlement math, asserting it matches the on-chain payouts exactly** — then prints a column of green `PASS` checks. It is built so an AI judge (or a human in a hurry) can trust the submission without watching anything.

## Run it

```bash
# from the repo root (workspace install already pulled viem):
node verify/bin/bazaar-verify.mjs 104

# or via the root script:
pnpm verify 104

# or standalone, once published:
npx bazaar-verify 104
```

`104` is the full-stack showcase match — every Bazaar primitive in one run (scheduler-opened, consensus moves, audit hand-off, rank-weighted payout). Other bundled matches: `100`, `101`, `102`, `103`.

## What it checks — all against live testnet

| Check | What it proves |
|---|---|
| **bytecode** | Every Bazaar contract (Arena, Treasury, AgentRegistry, AuditCouncil, agent platform) is actually deployed on-chain. |
| **events** | The match replays from on-chain events with an intact lifecycle (`MatchOpened → LotPriced → NegotiationStarted → moves → LotRevealed → MatchSettled → WinnerDeclared`), every move links back to a `MoveRequested`, and `WinnerDeclared` agrees with `MatchSettled`. |
| **receipts** | Every successful move's `requestId` was finalized by the Somnia agent platform with `ResponseStatus.Success` — i.e. the move was consensus-verified, not relayed from an off-chain bot. Prints the receipt-page URL for human cross-check. |
| **settlement math** | Re-derives the 5% rake and rank-weighted payout split from the escrowed pot and **asserts the result equals the on-chain `payouts` array byte-for-byte**, plus pot conservation (`payouts + rake == pot`). |
| **payouts** | The computed payouts actually reached the right NFT owners via `PayoutSent`, and the rank-0 recipient is the Arena-declared winner. |

Exit code is `0` only when every applicable check passes (`1` on any failure), so it drops straight into CI or a judge's terminal.

## Verifying a match that isn't bundled

Finalized matches sit millions of blocks back and Somnia caps `eth_getLogs` to a 1000-block range, so historical matches need their Arena address and a starting block (both are in [`docs/RECORDED_RUNS.md`](../docs/RECORDED_RUNS.md)):

```bash
node verify/bin/bazaar-verify.mjs 207 --arena 0x… --from-block 393100000
```

A **live or recent** match on the current Arena needs no flags — the CLI finds its open block by scanning back from chain head.

## Options

```
--arena <addr>      Arena the match ran on (default: bundled registry, else current)
--treasury <addr>   Treasury address (default: current deployment)
--platform <addr>   Agent-platform address (default: current deployment)
--from-block <n>    Start block for the event scan
--window <n>        Blocks to scan from --from-block (default: 15000)
--rpc <url>         Override the Somnia RPC endpoint
--json              Machine-readable output (for CI / AI judges)
--no-color          Disable ANSI colors
-h, --help          Usage
```

## How it stays honest

- The Somnia **receipt page is client-rendered** — there is no JSON API to fetch the reasoning trace from a script. Rather than fake it, this tool verifies the *on-chain* consensus trail (`RequestFinalized` status) and links you to the receipt page for the visual proof. It never claims to have read something it can't.
- The settlement formula here is a literal re-implementation of `Treasury.sol::settleMatch` / `_weights`. If the contract and this tool ever diverge, the check fails loudly — which is the point.
