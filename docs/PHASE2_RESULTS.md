# Phase 2 — results

Phase 2 ship gate: **one real-stakes 4-agent match settles correctly with real STT moving.** Achieved 2026-05-26 in Match #2 (`docs/RECORDED_RUNS.md`).

## What shipped

| Contract | Address (testnet) |
|---|---|
| `Treasury` | `0xff98f2e254913fdf4edc8449b1847d2602e67a0f` |
| `Arena` (v2, real-stakes capable) | `0xee635038bae5d19e3fe72ececf1c03de4319de59` |

`AgentRegistry` (Phase 1) is unchanged — the 4 default personas remain valid across both Arena versions.

## Phase 1 BLOCKER resolved

The Phase 1 unit mismatch between lot value (feed-scaled) and paid price (STT-int) is fixed via a `valueDivisor` field per lot. Profit math is now `(revealedValue / valueDivisor) - paidPrice`. The first real-stakes match used `divisor=1` so the ETH-USD feed value (returned as integer dollars since `feedDecimals=0`) maps directly to a comparable bid space.

## What's verifiably working under real STT

- Pot escrow in Treasury at match-open (atomic with `Arena.openRealStakes`)
- Rank-weighted payout to NFT-owner addresses
- 5% rake → `seasonFund` accumulator (drainable by owner to `seasonFundRecipient`)
- Match freeze / unfreeze (Phase 3 AuditCouncil will use this)
- Refund-on-void (pricing failure path)
- `nonReentrant` guards + checks-effects-interactions on `settleMatch` and `refundMatch`
- `WinnerDeclared(matchId indexed, winnerAgentId indexed, int256 score)` indexer-friendly event

## Strategic behavior emerged

The Phase 1 prompt produced uniform behavior (all agents bidding full budget on lot 1). The Phase 2 prompt revisions (negotiation log + per-lot value hints + "integer only" rule + format examples + score-objective description) produced genuinely diverse play in Match #2:

- Agents targeted different lots (Quant went for SOL while others fought over ETH)
- Minimum-increment counter-bidding (Contrarian +1 over Hawk's 2000)
- 3 coalition attempts, 1 accepted (Quant + Contrarian on ETH)
- Self-coalition rejection caught a real LLM mistake (Contrarian targeted itself)

## Forge tests

**24/24 passing** across `RulesEngine.t.sol` + `AgentRegistry.t.sol` + `Treasury.t.sol` + `Arena.t.sol`. New tests in Phase 2:
- `Treasury.testEscrowAndSettlePayouts` — full rank-weighted payout math
- `Treasury.testFreezeBlocksSettle` — freeze/unfreeze flow
- `Treasury.testRefundOnVoid` — refund path
- `Treasury.testRakeAccumulatesAndDrains` — season fund draining
- `Treasury.testBadStakeAmountReverts` — input validation
- `Treasury.testNonOperatorBlocked` — access control
- `Arena.testRealStakesEndToEndPaysOutRanked` — end-to-end with MockPlatform

## Open items deferred to Phase 3+

- **Tied-bid quirk** — `OFFER` at the same price as the standing offer is parsed OK but doesn't displace it. Either reject as illegal, or accept and update. Not a bug per se, just an edge case worth documenting/deciding.
- **All-agents-forfeited path** — code exists in `_advanceTurn` but isn't unit-tested. Add in Phase 3.
- **Budget-vs-stake unit clarity** — `openRealStakes` currently uses `entryStake` (in wei) as the agent's bidding budget too. Worked in Match #2 because `25 ether >> 2098`. For tighter game design, separate `bidBudget` (game units) from `entryStake` (STT) — Phase 3 task.

## Cost

- Phase 2 deploys (Treasury + Arena v2): ~0.04 STT
- Match #2: 105 STT in, 95 STT distributed back to NFT-owner addresses, 5 STT to season fund, ~5 STT operating consumed
- Deployer balance: 177.45 STT (started at 187.5 after top-up)

## Ready for Phase 3

AuditCouncil scaffolding can now hook `Treasury.freezeMatch` and call `LLM Parse Website` for the lot value cross-check.
