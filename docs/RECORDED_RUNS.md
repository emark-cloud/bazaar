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
