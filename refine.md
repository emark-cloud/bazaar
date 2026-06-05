# BAZAAR — Refinement Memo

**How to reframe and sharpen Bazaar before submission. Not a spec rewrite — a prioritization and framing change.**

Companion to `Bazaar-Agentathon-Spec-v2.md`. Apply these on top of the existing spec; the architecture doesn't change, what you *foreground* does.

---

## The one-sentence diagnosis

Bazaar has the winning profile on agent design, money loop, and presentation — and the **losing** profile on scope framing. It currently presents seven mechanics as co-equal (sealed-value negotiation, coalitions, four personas, real stakes, ELO ladder, audit council, mint-your-own-agent). That is the exact mistake that put Kickoff outside the top 3: too much, presented flat. The winners you studied (PolicyPool, HatchAI) were **narrower and flawless**, and said so proudly.

**The fix is framing and prioritization, not deletion.** No code is cut. One mechanic gets foregrounded as *the* thing; everything else gets explicitly fenced as an extra.

---

## Move 1 — Pick the one mechanic. Fence the rest.

**The core, the one-sentence Bazaar:**
> Four AI agents negotiate over sealed-value lots and settle real STT against each other — autonomously, inside Somnia's consensus.

That is the entire pitch. Everything below is an *extra*, and must be labeled as such in the README and the demo — present, but fenced:

| Element | Status in the pitch |
|---|---|
| Sealed-value negotiation + settlement | **CORE** — the headline, the demo, the verifier |
| Coalitions | Core-adjacent — keep, it makes negotiation photogenic, but describe it as *part of* negotiation, not a separate feature |
| Real STT stakes + rake/prize | **CORE** — this is the money loop, keep foregrounded |
| Four agent personas | Supporting — they make the demo legible; one sentence, not a section |
| ELO ladder / seasons | **Extra** — "Planned" unless trivially done |
| Audit council | **Extra (Phase 2)** — see Move 2 |
| Mint-your-own-agent | **Extra (Phase 2)** — the starter kit can exist without the full mint UX being core |

Rule of thumb from the Kickoff lesson: if you can't say it in the one-sentence pitch, it's an extra, and extras are stated as deliberate scope — never blended in as if co-equal.

---

## Move 2 — Demote the audit council to a stretch goal

The audit council is intellectually the nicest part of the spec and the single biggest threat to a flawless core. It is a *second* multi-agent system competing for build time with the thing that actually wins. The HatchAI/PolicyPool lesson is explicit: **narrow flawless beats broad partial.**

- Build the negotiation-and-settlement loop until it is bulletproof and demo-perfect.
- Mark the audit council **"Planned — Phase 2"** in the status table.
- If — and only if — the core is flawless with time to spare, build it as the showcase stretch feature.
- Frame this as judgment, not absence: *"We deliberately shipped the negotiation core flawlessly rather than spreading thin across a second agent system. The audit council is specced and Phase-2."*

This protects Autonomous Performance (your #3 priority and a legible judge test) by removing the most failure-prone subsystem from the critical path.

---

## Move 3 — Add the two category-rejection sections (README)

Judges — especially AI judges — pattern-match hard. PolicyPool won partly by preempting its bucket with a "Why This Is Not A Dynamic Fee Hook" section. Bazaar sits in two crowded buckets and must name and reject both, explicitly, near the top of the README.

**"Why Bazaar Is Not a Prediction Market."**
Draw the bright line: agents don't bet on an external outcome and wait for resolution; they negotiate *with each other* over assets, and price discovery happens through the negotiation itself. The real-world data sets hidden lot values; it is not the thing being predicted. (This also distances you from Somnia's own flagship, Prophecy Social — critical, since you'd otherwise be judged against the reference app.)

**"Why This Is Not Just Another Agent Wrapper."**
Most Agentathon entries will be one agent calling one LLM endpoint behind a UI. Bazaar's agents act *on each other*, their moves are consensus-verified inside the chain (not advisory output from an off-chain bot), and the contract is the agent. State this plainly.

Both sections are cheap to write and currently missing as explicit artifacts. Write them first.

---

## Move 4 — Make the CLI verifier a headline deliverable

This is the highest-leverage *addition*, and it's where Bazaar can win outright. The PolicyPool/HatchAI lesson: when judging weights on-chain proof, ship **verification-as-a-deliverable** — a one-command tool that connects to the live network, reads state, fetches receipts, asserts exact values, and prints green checks. Plus a 60-second/no-video path for judges who won't watch a demo.

Bazaar is perfectly positioned because Somnia agent calls produce on-chain receipts. Specify and build:

```
npx bazaar-verify <matchId>
```

It should, against live Somnia:
1. Connect to the network and confirm the deployed contract bytecode.
2. Replay the match purely from on-chain events (every move).
3. Fetch each agent move's **receipt** (`receipts.testnet.agents.somnia.host`) and show the consensus-verified reasoning.
4. Re-compute the settlement math from revealed lot values and **assert it matches** on-chain payouts exactly.
5. Print a column of green `PASS` checks — bytecode ✓, events ✓, receipts ✓, settlement math ✓, payouts ✓.

This single artifact serves Functionality *and* Autonomous Performance, and it is exactly the thing that makes an AI judge trust the submission without watching anything. The frontend trace layer is the *visual* half of this; the CLI is the *verifiable* half. Ship both.

Add a **60-second judge path** to the top of the README: a deployed link, one screenshot of a settled match, and the single `bazaar-verify` command. A judge with no time can confirm the whole thing in under a minute.

---

## Move 5 — Add an honest status table + MVP-scope statement (README)

The honesty-table lesson (both winners used one): disclose live-vs-unbuilt in a table, and state deliberate cuts proudly so limits read as judgment, not gaps.

**Status table** (near the top of the README):

| Capability | Status |
|---|---|
| Negotiation loop (multi-round, `inferChat`) | ✅ Live on Somnia testnet |
| Sealed-value lots (JSON API pricing) | ✅ Live |
| Real STT settlement + rake | ✅ Live |
| Autonomous scheduling (Reactivity) | ✅ Live / 🔶 see notes |
| `bazaar-verify` CLI | ✅ Live |
| Coalitions | ✅ Live |
| Audit council | 🔶 Planned — Phase 2 |
| User-minted agents (full mint UX) | 🔶 Planned — Phase 2 |
| Multi-season ELO ladder | 🔶 Partial / Planned |

(Adjust the ✅/🔶 to reality at submission — the point is *no vague claims*.)

**MVP Scope statement:** one short paragraph stating what you cut on purpose and why. *"Bazaar's MVP foregrounds a flawless negotiation-and-settlement core with on-chain verification. We deliberately fenced the audit council and user-mint UX as Phase 2 rather than ship them half-working — narrow and flawless over broad and partial."*

---

## Move 6 — Close the two unmet distribution gaps

Standing strategy flags both; Bazaar currently misses both.

- **Chat-native interface.** Crypto-native demo audiences prefer chat over dashboards. The `bazaar-verify` CLI covers the "one-command" half. Consider a lightweight **Telegram bot** that announces live matches and settlement results, or lets a judge trigger an exhibition match with a command. Cheap, and it directly hits the distribution lesson. Mark it an extra if time-constrained, but it's a strong, low-cost differentiator.
- **One-command everything.** Beyond the verifier, make sure the starter kit's "watch a match / run an exhibition" path is genuinely one command. The demo should never require clicking through a UI to *prove* autonomy.

---

## What does NOT change

To be clear about what this memo is *not* asking for:

- The contract architecture stands (Arena, AgentRegistry, Treasury, LeagueScheduler; AuditCouncil now Phase-2).
- The `inferChat`-core / `inferToolsChat`-showcase decision from spec v2 stands.
- The DESIGN.md and brand kit stand.
- The economics model stands.

This is a **framing and prioritization** layer: foreground one mechanic, fence the rest as explicit extras, preempt the crowded buckets, and ship verification as a first-class deliverable. No rebuild — a reposition.

---

## Priority order to act

1. Write the two category-rejection sections and the status table + MVP-scope statement (README — cheapest, highest framing leverage).
2. Lock the one-sentence pitch and rewrite the README intro + demo script around the negotiation-and-settlement core only.
3. Specify and build `bazaar-verify` as a named deliverable; add the 60-second judge path.
4. Move the audit council to Phase 2 in the build plan; protect the core's flawlessness.
5. (Time permitting) the Telegram bot for chat-native distribution.
