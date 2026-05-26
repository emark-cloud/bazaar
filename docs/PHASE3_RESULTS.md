# Phase 3 — results

Phase 3 ship gate: **AuditCouncil intercepts settlement, freezes Treasury, fires VRF + verdict + parse-website pipeline, finalizes per quorum.** Pipeline triggered live on testnet in Match #3 (`docs/RECORDED_RUNS.md`) 2026-05-26. Settlement is now audit-gated end-to-end.

## What shipped

| Contract | Address (testnet) |
|---|---|
| `Arena` (v3, audit-aware) | `0xb129ec7d06e3136517c188113fe9b8a10f882738` |
| `AuditCouncil` | `0xfef114227593e8afd8e029de5698a2f94e875789` |

`Treasury` (Phase 2) and `AgentRegistry` (Phase 1) reused. Three additional auditor personas minted: `JudgeA` (8), `JudgeB` (9), `JudgeC` (10).

VRF spike (Phase 0.9) deployed at `0x6A9625CfE2a49550C31848a0bF0db3923070A56f` — confirmed price calc + request acceptance against the Protofire VRF v2.5 wrapper.

## What's verifiably working

- **Audit hook in `Arena._settle`** — when `auditCouncil != address(0)` and the match is RealStakes, Arena calls `auditCouncil.beginAudit(matchId, competitors, ranked, lotCategories, lotUrls, lotNumPages, lotFeedValues)` instead of `treasury.settleMatch`. Same call stack, autonomous.
- **Treasury freeze gate** — `Treasury.freezeMatch(matchId, frozenUntil)` blocks any later `settleMatch` until the audit clears.
- **VRF native-payment request** — `VRFConsumerBase._requestRandomnessNative` pays the wrapper from the council's STT balance, encodes `ExtraArgsV1{nativePayment:true}` via the V2.5 tag `0x92fd1338`, hands the requestId back for tracking.
- **Auditor selection excludes competitors** — `_pickAuditors` walks the registry up to the first 64 minted IDs, filters out the four match entrants, then picks K via the VRF words mod-pool. Test `testCompetitorsExcludedFromAuditors` enforces.
- **Verdict tally — Threshold 5/3 inferString** — `handleVerdict` counts raw clean/suspect responses per request; per-auditor verdict = majority across that auditor's 5 validators.
- **Parse-website cross-check — Threshold 5/3 + on-chain median** — `handleParseCheck` sorts the successful uint responses and takes the median, then trips suspect if drift vs feed value exceeds `parseToleranceBps` (default 10%).
- **Quorum** — 2-of-3 verdict suspect OR any parse-check suspect ⇒ overall suspect ⇒ `Treasury.refundMatch`. Else `unfreeze + settleMatch`.
- **Appeal-window fail-open** — `appealTimeout(matchId)` is callable by anyone after `appealUntil`; flushes to clean to keep the protocol live if VRF or agents are slow.

## Phase 2 cleanups landed

- **Tied-bid quirk** — Arena now rejects an `OFFER` at the same price as the standing offer (explicit `MoveRejected`). Test: `testTiedOfferIsRejected`.
- **Forfeit-penalty cap** — `forfeitPenalty` is an owner-settable constant (default 100), replacing the runaway `-budget-in-wei` Phase-1 penalty that wildly dwarfed realistic profit. Test: existing forfeit tests pass under the cap.
- **All-agents-forfeited path tested** — `testAllAgentsForfeitedSettlesEmpty` covers the previously-untested `_advanceTurn → _toSettling` branch.

## Forge tests

**32/32 passing** across `RulesEngine.t.sol`, `AgentRegistry.t.sol`, `Treasury.t.sol`, `Arena.t.sol`, `AuditCouncil.t.sol`.

New in Phase 3:
- `AuditCouncil.testCleanAuditUnfreezesAndSettles` — full happy path with mock VRF + mock agents.
- `AuditCouncil.testSuspectQuorumRefundsEntrants` — 2-of-3 suspect verdicts → refund.
- `AuditCouncil.testParseDriftTripsSuspect` — parse-website median 100% off feed → refund.
- `AuditCouncil.testAppealTimeoutFailsOpenClean` — fail-open path after stuck audit.
- `AuditCouncil.testCompetitorsExcludedFromAuditors` — randomness can't pick match entrants.
- `AuditCouncil.testNonArenaCannotBegin` — only Arena can start an audit.
- `Arena.testTiedOfferIsRejected` — Phase 2 quirk fix.
- `Arena.testAllAgentsForfeitedSettlesEmpty` — previously-untested branch.

## VRF reality check

Phase 0.9 confirmed:
- Wrapper interface (`calculateRequestPriceNative`, `requestRandomWordsInNative`) accepts our calls.
- Price ≈ **0.002052 STT** per 3-word / 200k-gas request — well within the Phase 3 cost envelope.
- The wrapper forwards to underlying coordinator `0x7c240efc7f7e0a495fd6cf29ee7cd3c6e505639c` and emits `RandomWordsRequested` properly.

**Open issue:** fulfillment latency on Somnia testnet appears slow (Phase 0 spike still unfulfilled after 30+ min). Phase 3 demo has the `appealTimeout` fail-open path wired specifically for this. If VRF service is upgraded before submission, the fallback becomes a "graceful degradation" footnote rather than a primary path.

## Open items deferred to Phase 4+

- **Budget-vs-stake unit separation** — still unresolved. `entryStake` in wei flows directly into `m.budget[i]`; for tighter game design separate `bidBudget` (game units) from `entryStake` (STT wei). Not strictly required for further demos.
- **Coalition share-aware payout** — settlement still hard-codes 50/50; the parsed `share` field is dropped.
- **Strategy hooks pointer on Agent struct** — needed for the Phase 5 starter-kit "advanced users add deterministic guardrails" story.

## Cost (Phase 3 to date)

- Deploy: Arena v3 + AuditCouncil + 3 judge mints + 5 STT council top-up = ~17.5 STT
- Match #3 open: 105 STT (100 escrowed in Treasury, 5 operating to Arena)
- VRF request (council balance): ~0.003 STT
- Deployer balance after match-open: ~54.9 STT (was 159.9)
- **Demo outcome:** `appealTimeout(100)` invoked after the 5-minute window. AuditCouncil flushed to clean → Treasury unfrozen → 95 STT distributed by rank (50/28/15/7) + 5 STT rake to season fund. Tx `0x2e56252abcc35566c0e0cf259cafb6b389b824e7c0c7000e56c267e5737fa078`. Deployer balance recovered to 149.85 STT.

## Ready for Phase 4

LeagueScheduler can now subscribe to `Arena.MatchFinalized` (or `WinnerDeclared` for cheap indexing) and auto-open the next match. Audit gating means the scheduler doesn't need to worry about audit timing — it can fire on Arena events and trust the Treasury freeze to prevent premature payout.
