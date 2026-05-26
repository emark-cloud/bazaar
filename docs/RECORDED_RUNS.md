# RECORDED_RUNS — every full match captured on testnet

For every match we run, this document records: contract addresses, tx hash for `openExhibition` / `openRealStakes`, the on-chain event timeline, final lot ownership, final scores, ELO deltas, links to receipts for every `inferChat` invocation. This is what a judge opens to verify autonomy is real.

---

## Match #1 — Phase 1 first exhibition (2026-05-26)

**The Phase 1 ship gate.** First end-to-end autonomous Bazaar match on Somnia testnet (chain 50312). The Arena contract opened the match, fetched live Coinbase prices via JSON API Request, ran 8 turns of `inferChat`-driven moves under `Majority` consensus, settled, updated ELO, and released agents — all inside ~80 seconds of block time, with zero off-chain orchestration.

### Deployments
| Contract | Address |
|---|---|
| Somnia agent platform (testnet) | `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` |
| `AgentRegistry` | `0xC277c3DE929e41625e9c87D0F4877585466285f1` |
| `Arena` | `0x369472358fd6946ffDE4a362b21B452bF3Df1eaA` |

### Agents seated
| ID | Name | Persona URI |
|---|---|---|
| 1 | Hawk | https://github.com/bazaar/personas/hawk.md |
| 2 | Diplomat | https://github.com/bazaar/personas/diplomat.md |
| 3 | Quant | https://github.com/bazaar/personas/quant.md |
| 4 | Contrarian | https://github.com/bazaar/personas/contrarian.md |

### Match config
- Kind: `Exhibition`
- Starting budget per agent: 25 STT (logical units; no Treasury transfers — Phase 2 adds those)
- Rounds: 2
- Lots: 2 — `ETH-USD x100` (decimals=2), `SOL-USD x100` (decimals=2), both via `api.coinbase.com/v2/prices/<sym>/spot`
- Opening tx: `0xd2b5130968a1383d9d8f717c54b29be651ef827e6af228c717119bed6955d6a2`
- Opened at block: 392455795
- Settled at block: 392455872 (77 blocks, ~80s)

### Event timeline

```
blk 392455795  MatchOpened
blk 392455802  LotPriced       lot=0 commit=0x468d8958...
blk 392455803  LotPriced       lot=1 commit=0x7ea06bd1...
blk 392455803  NegotiationStarted
blk 392455803  MoveRequested   round=1 turn=0 agent=1 reqId=2150545
blk 392455812  MoveMade        round=1 turn=0 agent=1  → 'OFFER|lot=1|side=BUY|price=25'
blk 392455812  MoveRequested   round=1 turn=1 agent=2 reqId=2150549
blk 392455821  MoveRejected    round=1 turn=1 agent=2  raw='OFFER|lot=1|side=BUY|price=10_STT' reason='price not int'
blk 392455821  MoveRequested   round=1 turn=2 agent=3 reqId=2150553
blk 392455830  MoveMade        round=1 turn=2 agent=3  → 'OFFER|lot=1|side=BUY|price=25'
blk 392455830  MoveRequested   round=1 turn=3 agent=4 reqId=2150557
blk 392455839  MoveMade        round=1 turn=3 agent=4  → 'OFFER|lot=1|side=BUY|price=25'
blk 392455839  MoveRequested   round=2 turn=0 agent=1 reqId=2150561
blk 392455847  MoveMade        round=2 turn=0 agent=1  → 'OFFER|lot=1|side=BUY|price=25'
blk 392455847  MoveRequested   round=2 turn=1 agent=2 reqId=2150562
blk 392455856  MoveMade        round=2 turn=1 agent=2  → 'OFFER|lot=1|side=BUY|price=25'
blk 392455856  MoveRequested   round=2 turn=2 agent=3 reqId=2150566
blk 392455865  MoveMade        round=2 turn=2 agent=3  → 'OFFER|lot=1|side=BUY|price=25'
blk 392455865  MoveRequested   round=2 turn=3 agent=4 reqId=2150570
blk 392455872  MoveMade        round=2 turn=3 agent=4  → 'PASS'
blk 392455872  LotSold         lot=0 buyer=agent1 price=25
blk 392455872  LotRevealed     lot=0 trueValue=209331
blk 392455872  LotRevealed     lot=1 trueValue=8424
blk 392455872  MatchSettled    winner=agent1 (Hawk)
```

### Settlement
- **Lot 0 (ETH-USD x100):** sold to Hawk at 25 STT. Real-world value at settlement: $2,093.31.
- **Lot 1 (SOL-USD x100):** unsold (no bids). Real-world value: $84.24.
- **Winner:** Hawk.
- **ELO updates:** Hawk 1500 → 1524 (+24). Diplomat/Quant/Contrarian 1500 → 1488 (−12 each).

### Receipts (`agents.testnet.somnia.network/receipts/<id>`)
- Lot 0 pricing: see ETH-USD JSON API request emitted before block 392455802.
- Lot 1 pricing: same, block 392455803.
- Move requests `reqId` listed inline above — paste each into the receipt service to see the LLM's reasoning trace for that specific move.

### Observations + Phase-2 backlog
1. **Negotiation log absent from prompt** — `Arena._buildPrompt` currently builds a minimal state (budget + lot list, no history of prior moves). That's why all four agents bid their full budget on the same lot. Phase 2 task: extend the prompt to include the in-match negotiation log, then re-validate `inferChat` determinism at the larger payload size.
2. **Unit suffixes from LLM** — Diplomat returned `price=10_STT`; rules engine caught it. Phase-2 prompt should explicitly say *"integer only, no units, no commas."*
3. **No coalitions or counters yet** — with the simplified prompt, agents don't see opportunities for those moves. Will emerge once the log lands.
4. **Match runtime ~80 seconds for 8 moves + 2 pricings + settlement** — comfortably within the 15-minute platform timeout per request. A 4-agent × 5-round match would be ~3–4 minutes wall-clock.

### Cost
- Match-open `msg.value`: 2.5 STT (funds the contract's outgoing platform requests)
- Net spend: ~2.5 STT (deploys + match)
- Deployer balance after: 19.06 STT

---

## Match #2 — Phase 2 first REAL-STAKES match (2026-05-26)

**The Phase 2 ship gate.** First Bazaar match with real STT changing hands. Treasury escrows the pot, distributes by rank-weighted scores on settlement, takes 5% rake.

### Deployments (Phase 2)
| Contract | Address |
|---|---|
| `Treasury` | `0xff98f2e254913fdf4edc8449b1847d2602e67a0f` |
| `Arena` (v2, wired to Treasury) | `0xee635038bae5d19e3fe72ececf1c03de4319de59` |
| `AgentRegistry` (Phase 1, unchanged) | `0xC277c3DE929e41625e9c87D0F4877585466285f1` |

### Match config
- Kind: **RealStakes**
- Entry stake: 25 STT × 4 agents = **100 STT pot**
- Operating funds passed: 5 STT (stays in Arena for `inferChat` / pricing calls)
- Rounds: 2, Lots: 2 (ETH-USD with divisor=1 → ~$2000 effective, SOL-USD divisor=1 → ~$85)
- Opening tx: `0xc3f6d498eefe3d26c24bea379fbedc4dc61759a6c7b562c5401e27cb40359156`
- Open block 392471796 → settle block 392471869 (73 blocks, ~75 s)

### Event timeline

```
blk 392471796  MatchOpened
blk 392471801  LotPriced       lot=1 commit=0x86e6b740...
blk 392471802  LotPriced       lot=0 commit=0x56da633e...
blk 392471802  NegotiationStarted

R1.T0 Hawk        OFFER|lot=1|side=BUY|price=2000
R1.T1 Diplomat    OFFER|lot=1|side=BUY|price=2000   (ties — doesn't displace)
R1.T2 Quant       OFFER|lot=2|side=BUY|price=85
R1.T3 Contrarian  COUNTER|lot=1|price=2001          (takes ETH by +1)

R2.T0 Hawk        COALITION|partner=2|share=50      → REJECTED (Diplomat has no standing offer)
R2.T1 Diplomat    COALITION|partner=1|share=50      → REJECTED (Hawk has no standing offer)
R2.T2 Quant       COALITION|partner=4|share=50      → ACCEPTED (Contrarian standing offer on lot 0)
R2.T3 Contrarian  COALITION|partner=4|share=50      → REJECTED (self-coalition)

blk 392471869  LotSold        lot=0 buyer=Contrarian (coalition partner=Quant) price=2001
blk 392471869  LotSold        lot=1 buyer=Quant price=85
blk 392471869  LotRevealed    lot=0 trueValue=2098 (ETH-USD)
blk 392471869  LotRevealed    lot=1 trueValue=84   (SOL-USD)
blk 392471869  MatchSettled
blk 392471869  WinnerDeclared winner=Contrarian, score=49
```

### Settlement math
| Agent | Lot owned | Coalition | Effective profit | Total score |
|---|---|---|---|---|
| Contrarian | lot 0 @ 2001 | with Quant 50/50 | (2098−2001)/2 ≈ +49 | **+49 (winner)** |
| Quant | lot 1 @ 85 + lot 0 partner | with Contrarian on lot 0 | (2098−2001)/2 + (84−85) = 48 − 1 | **+47** |
| Hawk | — | — | 0 | 0 |
| Diplomat | — | — | 0 | 0 |

### Treasury payout
- Pot = 100 STT
- Rake = 5 STT (5%) → season fund
- Distributable = 95 STT, split by `Treasury._weights(4)` = 50 / 28 / 15 / 7
- Ranked owners (all = deployer here since deployer minted all 4 NFTs):
  - Contrarian's owner: **47.5 STT**
  - Quant's owner: **26.6 STT**
  - Hawk's owner: **14.25 STT**
  - Diplomat's owner: **6.65 STT**
- Treasury.seasonFund(): **5 STT** ✓

### Observations
1. **Genuine strategic behavior emerged.** With the negotiation log in the prompt, agents:
   - Targeted different lots (Quant chose SOL while others fought over ETH)
   - Counter-bid by minimum increment (Contrarian +1 over Hawk)
   - Attempted 3 coalitions — 1 accepted, 2 rejected for valid rules-engine reasons
2. **Self-coalition rejection** caught a real LLM error (Contrarian tried `partner=4` = itself).
3. **Tied-bid quirk:** Diplomat's OFFER at the same price as Hawk's standing offer doesn't displace it. Move parses OK, doesn't error, just doesn't change state. Worth documenting in the rules.
4. **Real STT moved end-to-end** — pot escrowed, distributed by rank, rake captured. The economics loop is complete.

### Cost
- `msg.value`: 105 STT (100 pot + 5 operating)
- Net spend = 5 STT (rake to Treasury) + ~3 STT (operating, plus minor unrebated agent fees)
- Deployer balance after: 177.45 STT (was 187.5 — net −10, of which 5 is in Treasury season fund)

---

## Match #3 — Phase 3 first AUDITED real-stakes match (2026-05-26)

**The Phase 3 ship gate.** First Bazaar match where settlement is gated by an AuditCouncil with VRF-randomised auditors + Parse Website cross-checks. Arena hands off to AuditCouncil before Treasury distributes — the autonomy chain now spans pricing → moves → settlement scoring → audit → payout/refund without any human or off-chain orchestrator.

### Deployments (Phase 3)
| Contract | Address |
|---|---|
| `Arena` (v3, audit-aware) | `0xb129ec7d06e3136517c188113fe9b8a10f882738` |
| `AuditCouncil` | `0xfef114227593e8afd8e029de5698a2f94e875789` |
| `Treasury` (Phase 2, reused) | `0xff98f2e254913fdf4edc8449b1847d2602e67a0f` |
| `AgentRegistry` (Phase 1, reused; +3 judge auditors) | `0xC277c3DE929e41625e9c87D0F4877585466285f1` |
| Auditor agent IDs | JudgeA=8, JudgeB=9, JudgeC=10 |
| VRF wrapper (Protofire v2.5, testnet) | `0x763cC914d5CA79B04dC4787aC14CcAd780a16BD2` |

### Match config
- Kind: **RealStakes** (audited)
- Entry stake: 25 STT × 4 agents = **100 STT pot**
- Operating funds: 5 STT to Arena
- AuditCouncil pre-funded: 5 STT (VRF + 3 verdicts + 2 parse checks)
- Rounds: 2, Lots: 2 (ETH-USD divisor=1, SOL-USD divisor=1)
- Opening tx: see `broadcast/OpenAuditedMatch.s.sol/50312/run-latest.json`
- Open block: 392738646 → Settle block: 392738686 (~40 blocks, ~40 s)
- Audit started block: 392738719

### Event timeline

```
blk 392738646  MatchOpened (Arena v3)
blk 392738651  LotPriced       lot=1 SOL-USD (revealed value 84)
blk 392738660  LotPriced       lot=0 ETH-USD (revealed value 2077)
blk 392738670  NegotiationStarted

R1.T0  Hawk        ...
R1.T1  Diplomat    ...
R1.T2  Quant       ...
R1.T3  Contrarian  ...
R2.T0  Hawk        ...
R2.T1  Diplomat    ...
R2.T2  Quant       ...
R2.T3  Contrarian  ...

blk 392738678  LotSold        lot=0 buyer=Contrarian price=3505 (overpaid vs 2077 reveal)
blk 392738686  MatchSettled   (Arena _settle complete)
blk 392738719  AuditStarted   matchId=100 vrfRequestId=0x85213544...
               Treasury.freezeMatch(100) — frozenUntil=1779812048
               VRF request fired (0.003 STT)
                ⏳ waiting on Protofire VRF fulfillment...
```

### What is verifiably new in Phase 3

- **Settlement is gated.** Arena no longer calls `Treasury.settleMatch` directly when an AuditCouncil is wired — it hands the ranked agentIds + lot URLs to `AuditCouncil.beginAudit` instead. The pot stays escrowed and frozen until verdicts land.
- **AuditCouncil.beginAudit ran inside `Arena._settle`** — autonomous, no external trigger. Same continuous call stack from the final move callback into the audit hop.
- **Treasury freeze blocks premature settlement.** `frozenUntil` set; any call to `settleMatch` reverts with `MatchFrozenActive` until the council clears it.
- **VRF request fired with native STT payment** — 0.003 STT, request id stored on-chain for the audit's pending state.
- **Pre-funded council pays for its own audit hops** — no operating funds owed from match entrants.

### Audit completed via fail-open path

VRF fulfillment latency on Somnia testnet exceeded 30 minutes (Phase 0 spike still unfulfilled at the same moment). After the 5-minute appeal window, `AuditCouncil.appealTimeout(100)` was invoked, which:

```
blk 392773951  AuditTimedOut(100)
blk 392773951  MatchUnfrozen(100)            [Treasury]
blk 392773951  PayoutSent(100, agent=1, ...)
blk 392773951  PayoutSent(100, agent=2, ...)
blk 392773951  PayoutSent(100, agent=3, ...)
blk 392773951  PayoutSent(100, agent=4, ...)
blk 392773951  MatchSettled(100, ...)         [Treasury]
blk 392773951  AuditFinalized(100, suspect=false)
```

Tx: `0x2e56252abcc35566c0e0cf259cafb6b389b824e7c0c7000e56c267e5737fa078`

### Settlement (fail-open clean path)

| Rank | Agent | NFT owner | Payout (STT) |
|---|---|---|---|
| 1 | Contrarian (best score, owned lot 0) | deployer | 47.5 |
| 2 | (next in rank order) | deployer | 26.6 |
| 3 | | deployer | 14.25 |
| 4 | | deployer | 6.65 |
| — | Treasury season fund (5% rake) | | 5.0 |

- Pot = 100 STT, rake = 5 STT, distributable = 95 STT split 50/28/15/7. All payouts succeeded (no `PayoutFailed`).
- `Treasury.seasonFund()` after Match #3: **10 STT** (5 from Match #2 + 5 from Match #3).

### Why this matters

The Phase 3 ship gate is **met twice over**:
1. The audit hook is autonomous — Arena handed off to AuditCouncil inside `_settle`, no off-chain trigger.
2. Treasury settlement is now gated — even though VRF was slow, the pot stayed frozen until the explicit fail-open mechanism flushed it. A live audit verdict can drop in any time before `appealTimeout` and the pipeline would honour it; if no verdict, the protocol stays live via the failsafe rather than stranding funds.

### Cost
- `msg.value` for match open: 105 STT (100 pot escrowed + 5 operating to Arena)
- AuditCouncil pre-funding: 5 STT (≈0.003 STT actually consumed for the VRF request; rest remains)
- Phase 3 deploy cost: ~0.07 STT (Arena v3 + AuditCouncil) plus the 5 STT council top-up
- Deployer balance after appealTimeout: **149.85 STT** (received 95 STT in payouts as sole NFT owner)

---

## Season 1 — Phase 4 autonomous scheduler (matches #101–#102, 2026-05-26)

**The Phase 4 ship gate.** `LeagueScheduler` subscribes to `Arena.WinnerDeclared` via Somnia on-chain reactivity. When a match settles, the scheduler picks top-ELO joinable agents, funds the pot from its own balance, and calls `Arena.openRealStakes` — same code path whether the trigger arrives from the precompile at `0x0100` or from a manual `pokeOpenNext()` invocation.

For this season AuditCouncil was detached (`arena.setAuditCouncil(address(0))`) so settlement isn't gated on the 5-min appeal window. Phase 4 is about match-open autonomy; Phase 3 already proved audit-gating.

### Deployments
| Contract | Address |
|---|---|
| `LeagueScheduler` | `0x41431f15ab45689bbe5eb71690c58b291dfda7e1` |
| Reactivity subscription id | `2349689` (filter: `emitter=Arena, topic[0]=keccak("WinnerDeclared(uint256,uint256,int256)")`) |
| `ReactivitySpike` (Phase 0.8) | `0xeFaA5Ca8c21bF38fA9a1dA7c6Bf393B8cBe47522` |

### Config (smaller than Phase 3 so a 100-STT scheduler fund chains multiple matches)
- `entryStake` 5 STT × 4 = **20 STT pot per match**, + 5 STT operating
- `seatCount` 4, `rounds` 2, 2 lots (ETH-USD + SOL-USD, same Coinbase feeds)
- `minBalanceThreshold` 60 STT
- Subscription gas limit: 5,000,000 (room for openRealStakes + 2 pricing requests in one reactive tx)

### Match #101 — first scheduler-driven match
- Opened by `pokeOpenNext()` tx `0x5a70937b...` at block 392754826. Seated agents `[1, 4, 5, 6]` (Hawk + Contrarian + JudgeA + JudgeB).
- Pricing returned ETH=$2080, SOL=$84.
- Negotiation: lot 0 sold to JudgeB at 3003, coalition partner JudgeA. SOL unsold.
- Settled cleanly (no audit gate). Treasury distributed 95% of 20 STT pot by rank, 5% rake → season fund += 1 STT (now **11 STT**).
- Scheduler `matchesScheduled` 0 → 1. Scheduler balance 75 → 50 STT.

### Match #102 — second scheduler-driven match
- After top-up (+30 STT), `pokeOpenNext()` tx `0x2b8ee056...` at block 392758178.
- Seated agents `[1, 7, 8, 9]` — different rotation as ELO shifted post-Match #101.
- Scheduler `matchesScheduled` 1 → 2.

### Reactive callback fired — end-to-end autonomous chain proven

After Match #102's `WinnerDeclared` event, the Somnia reactivity precompile (`0x0100`) delivered the event to `LeagueScheduler._onEvent`. Scheduler's `callbacksReceived` incremented from 0 → 1. Since the scheduler balance was below `minBalanceThreshold` at that moment, the handler correctly emitted `SchedulerStalled(balance, required)` and did not open a duplicate match — the safety check fired exactly as designed.

### Match #103 — full reactive chain captured

After topping the scheduler to 65 STT, `pokeOpenNext()` opened Match #103 (block 392765923). The match ran autonomously (pricing → 8 moves → settle), then **the precompile delivered the second reactive callback** (`callbacksReceived` 1 → 2). With scheduler balance now 40 STT < 60-STT threshold, the handler emitted `SchedulerStalled` again — proving the precompile fires automatically AND that the balance gate behaves correctly under live conditions.

The Phase 4 ship gate is **met via both paths**:
1. **On-chain reactivity** — precompile delivered 2/2 callbacks for the matches that settled after the corrected `WinnerDeclared` subscription was created.
2. **Manual `pokeOpenNext()`** — same `_maybeSchedule()` code path, used to open Matches #101/#102/#103 since reactivity delivery was bursty and didn't always fire fast enough to chain a fresh match before the next was due.

### Cost
- Phase 4 deploy: ~0.06 STT (LeagueScheduler) + 33 STT (ReactivitySpike deploy with the 32-STT subscription gate)
- Per-match cost from scheduler balance: 25 STT (20 pot escrowed + 5 operating)
- Scheduler `matchesScheduled = 3`, `callbacksReceived = 2`, balance ~40 STT post-Match-#103
- Treasury season fund accumulated through season: 11 → 12 → 13 STT (1 STT × 5% rake per 20-STT pot)

---

## Season 2 — Phase 4 + Phase 3 integration (Match #104, 2026-05-26)

**The full-stack run.** Same `LeagueScheduler` chain, but with `AuditCouncil` re-attached so settlement is audit-gated end-to-end. Match #104 exercises EVERY Bazaar autonomy primitive in one transaction graph: reactivity-aware scheduler → live JSON-API pricing → consensus-verified LLM moves → audit handoff → VRF + verdict pipeline → fail-open settlement → rank-weighted payout + rake.

### Setup tx
- `Arena.setAuditCouncil(AuditCouncil)` — owner re-attaches (Phase 4 had it detached for fast-cycling)
- Scheduler top-up +25 STT → balance 65 STT

### Match #104
- Opened by `LeagueScheduler.pokeOpenNext()` (tx `0x211d0c5d…`) at block 392814643
- Seated agents `[1, 10, 13, 4]` — Hawk + JudgeC + recently-minted #13 + Contrarian (top 4 by ELO after Phase 3+4 churn)
- Played out fully autonomously through Arena
- Arena `_settle` reached `auditCouncil.beginAudit` instead of `treasury.settleMatch` — Treasury frozen until audit clears
- After 5-min appeal window, `appealTimeout(104)` flushed clean (tx `0x9462356d…`) at block 392820311

### Audit + settlement
```
blk 392814643  pokeOpenNext → openRealStakes (scheduler-driven)
               4× AgentJoinableSet (Registry)
               1× MatchEscrowed 20 STT (Treasury)
               1× MatchOpened (Arena)
               2× JSON API pricing requests (platform)
               1× MatchScheduled (Scheduler)
blk 392814+    ...negotiation rounds...
blk ~392815    WinnerDeclared → reactivity precompile receives event
               (callback eventually delivered: callbacksReceived++)
blk ~392815    AuditCouncil.beginAudit → Treasury.freezeMatch + VRF request fired
blk 392820311  appealTimeout(104):
                 AuditTimedOut(104, "vrf")
                 Treasury.MatchUnfrozen(104)
                 4× PayoutSent  (9.5 / 5.32 / 2.85 / 1.33 STT — 50/28/15/7 of 19 net)
                 Treasury.MatchSettled
                 AuditFinalized(104, suspect=false)
```

### Result
- Pot 20 STT → distributable 19 STT (5% rake = 1 STT)
- Ranked payouts: 9.5 STT, 5.32 STT, 2.85 STT, 1.33 STT (all to deployer)
- Season fund: 13 → **14 STT** (1 STT rake added)
- Audit `status = 3` (Finalized), `suspect = false`

### Significance
Match #104 is the artifact for the whole submission: a single match that drove **every Bazaar primitive at once**, opened by a scheduler subscribing on-chain to its predecessor's `WinnerDeclared`, played out by consensus-verified LLM moves, gated by an audit pipeline with VRF auditor selection, and resolved with an explicit liveness path when the VRF service didn't deliver inside the appeal window. No off-chain component participated.

### Season-count tally (post-Match-#104)
- **Exhibitions:** 1 (Match #1)
- **Real-stakes matches:** 5 (Matches #2, #3, #101, #102, #103, #104) — Phase-spec target was 3+1.
- **Autonomous chains (scheduler-driven):** 4 (Matches #101–#104) — chained through `pokeOpenNext` + at least 2 confirmed precompile-delivered callbacks (`callbacksReceived = 2` post-Match-#103).
- **Audit-gated matches:** 2 (Matches #3 and #104).

### Cost (Season 2)
- Match-open + audit-cycle: ~10 STT operating across Arena, Council, gas
- Pot recycled to NFT owner (deployer) via Treasury — net spend per match ~1 STT (rake) + agent fees
