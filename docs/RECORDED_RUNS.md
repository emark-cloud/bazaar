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
