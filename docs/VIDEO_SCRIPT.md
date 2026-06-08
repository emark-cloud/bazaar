# VIDEO_SCRIPT — Bazaar demo walkthrough (≤ 4:00)

The demo video is the single most important part of the submission. This script foregrounds the
wow moments and the one falsifiable claim — *autonomy you can verify on-chain* — and cuts everything
that doesn't earn its seconds. It does **not** try to show every screen.

**Format.** Screen recording at 1920×1080 + voiceover. Capture a real match (or a clean replay) so
the negotiation, the coalition beat, and the settlement reveal are real on-chain events.
**Target runtime:** 3:50–4:00. **Voiceover budget:** ~580 words.

**Two designated hero captures** (per `design.md` §6): the **coalition-forming** moment and the
**settlement reveal**. Everything is built around those two beats.

---

## Cold open — THE HOOK · 0:00–0:18

**On screen.** Black. Then the Hub's live mini-match fades up — four agent sigils, moves already
streaming in, a round counter ticking. No cursor, no human. Hold on it for a beat before the first word.

**VO.**
> "Everything you're watching right now is four AIs haggling over real money — and there is no human
> anywhere in this loop. No bot driving it. No oracle feeding it. No server. Just a smart contract,
> acting as the auctioneer, while the players think for themselves. This is Bazaar."

*(Pitch the hook on "no human anywhere in this loop." The autonomy claim is the whole submission —
lead with it, don't bury it.)*

---

## THE PREMISE · 0:18–0:42

**On screen.** Cut to the Live Match screen — the four-region terminal grid. Pan slowly: agents left,
negotiation center, sealed lots right (locked glyphs).

**VO.**
> "Four agents enter an arena. The contract hands them lots — assets whose real-world value is pulled
> live on-chain and then *sealed as a hash*. The agents know the category. They don't know the price.
> So they do what traders do: they bluff, they counter-offer, they cut side-deals — and every single
> move is a real LLM call, run inside Somnia's consensus. Not relayed. *Verified.*"

---

## THE CENTERPIECE — A LIVE NEGOTIATION · 0:42–1:45

**On screen.** This is the screen the demo lives or dies on. Let moves stream in real time. As each
agent's turn resolves, its line lands in the transcript in its persona color. Zoom the transcript
slightly so move labels are legible: `OFFER`, `COUNTER`, `COALITION`, `PASS`.

**VO.**
> "Watch Hawk open aggressive — full budget on one lot. The Diplomat doesn't take the bait; it
> counters low and waits. Then this —"

**On screen. ⭐ HERO BEAT 1 — COALITION.** A `COALITION` move lands. Highlight it: a binding link
animates between two agent sigils (shared cost, shared payout). Let it breathe.

**VO.**
> "— two agents just formed a *coalition*. A binding side-deal, struck mid-negotiation: shared cost,
> shared payout, enforced by the contract. Two of these agents just decided, on their own, that
> together they could beat the other two. That is genuine agent-to-agent strategy — and it's settling
> on-chain."

*(If recording live is risky, use a replay of a match with a clean coalition. Same screen, same motion.)*

---

## THE REVEAL — SETTLEMENT · 1:45–2:15

**On screen. ⭐ HERO BEAT 2 — SETTLEMENT.** A round passes with no trade → the match ends early
(emergent termination). The sealed lots flip from locked glyphs to their revealed real-world values
with sources. The mini-ladder reorders with a FLIP animation as P&L resolves. A winner is crowned;
STT payouts animate out of escrow.

**VO.**
> "A round passes with no trade — so the match just *ends itself*. The contract reveals every lot's
> true value, scores the books, and pays out real STT from escrow — winner takes the most, five
> percent rakes to the season fund. Whoever read the hidden value best, wins. Nobody pressed a button."

---

## UNDER THE HOOD — THE "ONLY ON AN AGENTIC CHAIN" MOMENT · 2:15–2:52

**On screen.** Toggle the **"under the hood"** trace layer open beside the match. One move expands
into its full Somnia execution trace: `createRequest` → subcommittee → `Majority` consensus →
callback. Click through to a **consensus receipt** in the explorer.

**VO.**
> "Here's the part that can't fake it. Open any move and you see its execution trace: the contract
> fired an on-chain inference request, a committee of validators ran the model, and they had to agree
> *byte-for-byte* before the move counted. Here's the receipt, on the block explorer. This isn't an AI
> wrapper calling an API in the background. The reasoning happens *inside consensus* — which is why
> Bazaar simply cannot exist on a chain that isn't agentic."

---

## IT'S REAL, AND IT'S AUTONOMOUS · 2:52–3:25

**On screen.** Quick, confident cuts — no lingering:
1. Terminal: `pnpm verify 104` → column of green `PASS` checks (events ✓ receipts ✓ payouts ✓).
2. The `LeagueScheduler` address on the explorer → the reactive callback tx that seated the next match.
3. A flash of the audit-council verdicts (`clean` / `suspect`).

**VO.**
> "And you don't have to take my word for any of it. One command — `verify` — replays a real match
> from on-chain events and re-computes every payout against the chain. Green means it checks out.
> When a match ends, an on-chain scheduler *automatically* seats the next one — no keeper. And a
> council of randomly-chosen auditor agents reviews each match for foul play. The referee is a
> contract. Even the integrity check is an agent."

---

## YOU CAN PLAY TOO — THE CTA · 3:25–3:55

**On screen.** The Mint screen: name an agent, the strategy-prompt editor, the generated sigil
preview. Then cut to the terminal: `npx create-somnia-agent`. End on the Hub with the live match
ticking and the wordmark + hosted URL on screen.

**VO.**
> "Want your own agent on the ladder? Write a strategy prompt, mint it in the browser, and it joins
> the next match — or scaffold one locally with a single command and our starter kit. The arena is
> live right now. Come watch your agent bluff for real money.
>
> **Bazaar. The marketplace where the agents are the players. Link's below — go break it.**"

**On screen (end card).** Wordmark · hosted Arena URL · `github.com/<repo>` · "Built on Somnia."

---

## Production notes

- **Record the match first.** Everything keys off a single clean run with a visible coalition and an
  emergent (no-trade) ending. Capture 2–3 candidate matches; pick the most dramatic for the hero beats.
- **Pace.** Cold open is silent for ~1.5s before the first word — let the motion sell autonomy before
  the claim does. Keep the back third (verify / scheduler / audit) on fast cuts; it's proof, not exposition.
- **Legibility.** Zoom the transcript and the trace layer; default font is too small for video at 1080p.
- **The two numbers that matter on screen:** the green `PASS` column and a real explorer receipt URL.
  If a skeptical judge believes those two frames, the submission is won.
- **Fallback if live capture is flaky:** Somnia testnet RPC degrades (see memory). Record against a
  replay of a known-good match — the frontend's replay path is visually identical to live.
- **Music:** low, tense, minimal. Drop it out under the "under the hood" receipt beat so the explorer
  click reads as evidence, not spectacle.
