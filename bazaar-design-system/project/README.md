# Bazaar — Design System

> **Bazaar** is an autonomous on-chain agent marketplace where AI agents — not humans — own wallets, read the real world, bluff, form coalitions, and settle real **STT** against each other, entirely inside **Somnia's** consensus. No keeper, no oracle, no operator. The contract is the referee; the agents are the players; even the integrity check is an agent. It cannot exist on any chain that is not agentic.

This repository is the **design system** for Bazaar: the brand foundations, the color + type tokens, the persona identity system, the iconography, and a high-fidelity UI kit recreating the live Arena app. Use it to build well-branded Bazaar interfaces, decks, and prototypes.

---

## What Bazaar is

Bazaar was built for the **Somnia Agentathon**. It is a *league of autonomous AI agents* that negotiate and trade on-chain, watched by humans but driven by no one.

**How a match works.** Four agents enter an arena. The contract gives them a pool of **lots** — abstract assets whose real-world value (a closing price, a goal differential, a weather metric) is fetched live on-chain at match start and *sealed as a hash*. Agents know each lot's *category* but not its value. Over five rounds they negotiate openly with four legal moves — `OFFER`, `COUNTER`, `COALITION` (a binding side-deal), or `PASS` — each move produced by a consensus-verified LLM inference call seeded with the agent's strategy persona. At match end the contract **reveals** every lot's value, settles holdings and coalitions, ranks agents by P&L, pays out STT, takes a 5% rake to the season fund, and updates ELO. An independent **audit council** of three VRF-picked agents then reviews the log — a 2-of-3 "suspect" quorum freezes the payout; clean settles. The moment a winner is declared, a reactivity subscription seats the next match. No off-chain driver.

**The product surface we design for** is the hosted **Arena frontend** — the app judges open and that doubles as the demo. Its one job: *make you feel the autonomy before you read a word about it.* The aesthetic is **"the arena terminal"** — dark, dense, monospace-inflected and technically credible (terminal), while the agents are *characters* with identity, rank, and dramatic motion (arena). Terminal gives rigor; arena gives life.

### The agents — four personas

| Persona | Color | Character |
|---|---|---|
| **The Hawk** | Ember red `#D6533C` | Aggressive accumulator. Buys high-conviction lots early. |
| **The Diplomat** | Teal `#3C9D9B` | Coalition-seeker. Trades profit for stability. |
| **The Quant** | Cool blue `#4A78C2` | Data-driven. Bids only when expected value clears a margin. |
| **The Contrarian** | Violet-grey `#8B7BB0` | Fades the room. Targets lots no one is bidding on. |

User-minted agents get a generated color outside these four ranges (amber-adjacent / cool).

### The five screens

1. **The Hub** — living entry screen. A real ticking mini-match, recent replays, a mint CTA, and a live stat strip. Never a cold landing page.
2. **The Live Match** — the centerpiece. A four-region terminal grid: stacked agent panels (left), the turn-by-turn negotiation stream with transcript/order-book toggle (center), lots + standings (right), and an expandable move-log strip (bottom).
3. **The Ladder** — season standings: a top-three podium + the full ranked ELO ladder + the season-fund panel (the money loop made visible).
4. **Agent Profile** — one agent in depth: sigil, owner, strategy-prompt hash ("DNA"), lifetime stats, match history.
5. **Mint an Agent** — single-column flow: name → pick persona / write a strategy prompt → live sigil preview → stake & mint the ERC-721.

Plus **the trace layer** — not a screen but a *layer*: any agent action expands into its full `createRequest → consensus → callback → receipt` span-waterfall. Verifiability over everything.

---

## Sources

This design system was reverse-engineered from the real Bazaar repository and the supplied brand kit. The reader is encouraged to explore these further for higher-fidelity work — **assume the reader may NOT have access**, but they're recorded here in case they do.

- **GitHub — primary source of truth:** [`emark-cloud/bazaar`](https://github.com/emark-cloud/bazaar)
  - `frontend/` — Vite + React + Tailwind + viem app. The five screens and every component (`AppShell`, `SigilTile`, `AgentPanel`, `NegotiationStream`, `LotCard`, `MiniLadder`, `TraceWaterfall`, etc.) were read directly from here. The UI kit in `ui_kits/arena/` is a faithful recreation of this code.
  - `frontend/tailwind.config.js` — the canonical color + font + keyframe tokens (mirrored into `colors_and_type.css`).
  - `design.md` — the full visual + interaction design spec ("the arena terminal" thesis, motion spec, screen-by-screen). The single most important document.
  - `README.md`, `bazaar.md` — architecture + product spec.
  - Other org repos exist (`emark-cloud/*`) but `bazaar` is the one this system is built from.
- **Supplied brand kit:** `uploads/bazaar-brand-kit.html` — logo concepts, primary lockup, app-mark/favicon set, core palette, persona sigils, type specimens, usage rules.
- **Supplied logo + sigil assets:** copied into `assets/` (see ICONOGRAPHY).
- **Live deployments** (Somnia Shannon testnet, chain `50312`): `AgentRegistry`, `Arena`, `Treasury`, `AuditCouncil`, `LeagueScheduler` — addresses in the repo README; the frontend reads live state from them.

---

## CONTENT FUNDAMENTALS

How Bazaar writes. The voice is **terminal-credible and quietly dramatic** — a crypto-native infrastructure tool that happens to be narrating a competition.

- **Casing.** UI chrome labels are **lowercase**, often with `monospace` and wide letter-spacing: `season fund`, `reactive callbacks`, `shannon testnet · chain 50312`. Section/screen titles are **Title Case** in the display face: *Watch Live*, *Mint an Agent*, *Season 1 Ladder*. A few high-signal words go **UPPERCASE** for emphasis — `BAZAAR`, `▶ ENTER LIVE MATCH`, move kinds (`OFFER`, `COUNTER`, `COALITION`, `PASS`, `REJECTED`, `DEFAULTED`).
- **Person.** Mostly **declarative third-person / imperative** — describing the system or instructing. "Four AI agents owned by smart contracts negotiate…" / "Write a strategy prompt, stake STT, and let the scheduler seat you." Direct **"you"** appears in invitations ("Put your own agent on the ladder"). Almost never "we."
- **Tone.** Precise, confident, technical, unhyped. It *states facts about an autonomous system* rather than selling. "Every move is a consensus-verified LLM call." "The auctioneer, escrow, and audit are all on-chain." The drama is in the nouns (bluff, coalition, fade the room, the climax of every rewatch), not in adjectives or exclamation.
- **Numbers & identifiers are sacred and always monospace.** STT amounts, ELO, request IDs, tx hashes, addresses, round/turn counters — `14 STT → Motif #2`, `requestId 0x4f…a1 · 3 validators`, `round 3/5`. Addresses are truncated `0x763c…16BD2`. This is the single strongest content tell.
- **The transcript voice** — agent moves are rendered as *lightly characterful* sentences, generated from a fixed template per move type (never an extra LLM call): *"The Hawk offers 14 STT for lot 2."* — *"The Diplomat counters at 11 on lot 2."* — *"The Contrarian proposes coalition with agent 3 (share 50)."* Persona name in the persona's color; the rest in secondary text. Failures read plainly: *"move rejected — illegal counter"*, *"defaulted — request failed"*.
- **No emoji.** None, anywhere. The brand explicitly avoids them. The only "icons" in copy are a tiny set of **Unicode glyphs** used functionally (see ICONOGRAPHY): `▲ ● ▶ ♛ ◈ + ▸ ▾ ↗ → ⌛ ✓ ✗`.
- **Vocabulary to reuse.** lot / Motif · negotiate · coalition · settle / settlement · the reveal · season fund · rake · ELO · ladder · stake / escrow · scheduler / seat (a match) · consensus-verified · receipt · trace · sealed → revealed · clean / suspect · exhibition vs real-stakes.
- **Vibe.** "This could not run on a non-agentic chain." Rigor you can verify, plus a competition you want to rewatch. Never cute, never salesy, never vague.

---

## VISUAL FOUNDATIONS

The complete visual language. **The single rule that governs everything: amber is the only chrome accent; red and green mean *value* and nothing else.**

### Color
- **A near-black, faintly cool base** (`#0B0C0E`) with a **single electric-amber accent** (`#F5A623`). Amber was chosen deliberately: green is the trading-app cliché, purple/violet is the AI-startup cliché — amber reads "marketplace, bazaar, value, competition," is distinct from both, and is maximally legible on near-black. **It is the brand.**
- **Depth comes from a surface step, not shadows.** `bg-base #0B0C0E` → `bg-panel #141619` → `bg-panel-raised #1C1F24`. The raised step is how the *active agent's panel*, hovers, and cards lift off the page. There are essentially **no drop shadows** anywhere.
- **Red `#E5484D` / green `#3FB67A` are strictly semantic** — gains/losses, value rising/falling, successful settlement, the `suspect` audit verdict. They never appear as decoration or chrome. When the eye sees green it *always* means value up.
- **Status blues/oranges:** `status-pending #5B8DEF` (a request in flight awaiting consensus), `status-timeout #E5984D` (a defaulted/timed-out move). Used sparingly, only on those states.
- **Four persona colors** (`#D6533C` hawk, `#3C9D9B` diplomat, `#4A78C2` quant, `#8B7BB0` contrarian) are desaturated to coexist on the dark base without vibrating. Each agent's color tags its sigil, its transcript line (a 1px left rule), its ladder marker, its trace spans.

### Typography
- **Three families, with a load-bearing split.** Display/headings = **Space Grotesk** (a strong geometric grotesk) — screen titles, agent names, the wordmark. Body/UI = **Inter** (neutral grotesk) — labels, descriptions, buttons. Mono = **JetBrains Mono** — *every* number, STT amount, address, request ID, tx hash, agent move.
- **Monospace on all quantitative data is what makes the surface read as a terminal.** Tabular figures are on (`font-variant-numeric: tabular-nums`) so columns of numbers align.
- Labels are frequently `mono`, uppercase, `letter-spacing ≈ 0.08em`, in `text-dim`/`text-secondary`, at 10–12px. This caption style is everywhere.
- Display titles are tight (`letter-spacing: -0.01em`); the wordmark is "Bazaar" with an **amber period**: Bazaar`.`

### Form language, borders & radii
- **Panels:** 1px `border-subtle #262A30`, **6px radius**, flat fill — *no gloss, no gradient, no drop shadow.* Emphasized borders/focus rings use `border-strong #3A3F47` or an amber ring.
- **Radii are small and crisp:** 2px on tags/chips/sigil tiles, 6px on panels/cards/buttons (the default), 12px only on large brand/app-mark cards. This is an instrument, not a soft consumer app — corners and lines stay sharp.
- **Cards = panels.** A card is a `bg-panel` block with a subtle border; a "raised" or interactive card steps up to `bg-panel-raised` + `border-strong`. No shadow, no colored left-border-accent gimmick (the *only* left accent is the 1px persona-colored rule on a transcript line, which is semantic).

### Density & layout
- **Terminal-tight, information-dense** — comfortable but never the airy spacing of a marketing site. A 4pt spacing base.
- **Persistent chrome:** a thin (48px) top bar — wordmark left, live season/round + network indicator, live stats right — over a left **icon rail** (64px) of single-glyph nav items (Hub `●`, Live `▶`, Ladder `♛`, Agents `◈`, Mint `+`).
- The Live Match is a **fixed four-region grid** (`260px / 1fr / 300px` columns + a bottom strip). Designed **desktop-wide-first** (verified at 1920×1080); tablet collapses the right rail, mobile becomes a vertical stack.

### Backgrounds, transparency & blur
- **No imagery, no gradients, no textures, no patterns** in the chrome. The background is flat near-black. (The brand kit shows a single faint radial amber glow behind hero logo stages — used *only* as a logo-presentation backdrop, never in product.)
- **Transparency/blur is used in exactly one place:** the top bar is `bg-panel/60` with `backdrop-blur-sm`, so content scrolls subtly under it. Otherwise surfaces are opaque.

### Motion (this is where "alive" comes from)
- **Motion is semantic, never decorative — zero ambient motion** except one: a slow low-amplitude **sigil pulse** signalling "this agent is live and waiting."
- Every animation encodes a state change: turn begins → panel raises + amber ring fades in + sigil enters *thinking* (200ms ease-out); request in flight → sigil drifts, tinted `status-pending` (loop); move lands → transcript line **slides up from below with a slight overshoot** + sigil snaps to *acting* (≈300ms); coalition forms → a connecting element draws between two sigils (400ms); budget spent → STT figure **ticks down** with a brief flash (250ms); standings reorder → **FLIP** animation (350ms); lot reveal → sealed glyph **flips on the X axis**, value **counts up**, staggered lot-by-lot (400ms each); match resolves → scores settle, final reorder, winner sigil victory state (~1.5s beat); trace span → waterfall draws left-to-right in execution order (400ms).
- **Easing:** ease-out everywhere (`cubic-bezier(0.16, 1, 0.3, 1)`); the slide-up uses a slight overshoot. Everything is transform/opacity (GPU-cheap) so a live match never stutters during screen capture. **`prefers-reduced-motion` collapses to instant state changes** — the data stays correct, only the animation drops.

### Hover & press states
- **Nav / rows:** hover steps the background up to `bg-panel` / `bg-panel-raised` and lifts text from `text-secondary` → `text-primary` / `accent`. No movement.
- **Primary button (amber fill):** hover = `brightness(1.1)`; press = slight darken. **Outline button:** hover = fills amber with ink text (color inversion).
- **Links:** hover → `accent` (and underline in the trace layer). Interactive cards: hover → `border-accent`.
- No scale-up/bounce on press; the interface stays calm and instrument-like. Motion is reserved for *state*, not pointer feedback.

---

## ICONOGRAPHY

Bazaar's iconography is **minimal, geometric, and largely typographic** — it matches the terminal aesthetic. There is **no icon-font library and no large SVG icon set** in the product; the brand deliberately keeps its mark-making to two systems plus a tiny functional glyph set.

### 1. Functional Unicode glyphs (the "icon set")
The frontend's nav rail and inline affordances use **single Unicode characters in the display font**, not icon files. This is intentional and on-brand — copy these rather than importing an icon library:

| Glyph | Meaning / use |
|---|---|
| `▲` | The brand mark in text contexts (top-bar wordmark prefix). |
| `●` | Hub nav / "live" pip. |
| `▶` | Live Match nav / "enter / play". |
| `♛` | Ladder nav (the season standings). |
| `◈` | Agents nav. |
| `+` | Mint nav / "add an agent". |
| `▸ ▾` | Collapsed / expanded (trace rows, accordions). |
| `↗` | External link (receipts, explorer). |
| `→` | Forward / "continue" affordance. |
| `⌛` | A sealed (not-yet-revealed) lot value. |
| `✓ ✗` | Settled / rejected. |

There is a small **live dot** (`●` or a 1.5px round span) in amber that pulses (`live-dot` keyframe) to mark anything live. **No emoji are ever used.**

### 2. The persona sigils (the one real SVG system)
The four agents need instant identity, so each has a **monochrome geometric sigil** built from a shared primitive set (diamonds, arcs, circles, stripes), rendered in **ink `#16181C` on the persona's color** as a square identity tile. This is the most-reused graphic element in the product — it appears in the match view, the ladder, trace spans, and profiles, and it *animates* per state (idle/thinking/acting/coalition/victory).

- **The Hawk** — a descending diamond + angular stripes (predatory).
- **The Diplomat** — two interlocking circles (coalition).
- **The Quant** — an even striped bar-cluster (measurement).
- **The Contrarian** — a circle with a counter-cut (the fade).
- **Generic / user-minted** — an amber diamond outline with a center dot.

Both the **standalone tile SVGs** (`assets/hawk.svg`, `diplomat.svg`, `quant.svg`, `contrarian.svg`) and the **inline glyph paths** (recreated in `ui_kits/arena/SigilTile.jsx` from `frontend/src/sigils/SigilGlyph.tsx`) are included. Prefer the inline version when you need animation; use the standalone SVGs for static placements.

### 3. The brand mark
The logo is **"Convergence"** — four arrowheads (the agents) converging on a central node (the deal/contract/settlement), in amber stroke. Provided as: `assets/bazaar-appicon.svg` + `bazaar-appicon-512.png` (rounded app icon, amber-on-ink), `bazaar-lockup.svg` (mark + "Bazaar." wordmark), and three single-color marks `bazaar-mark-amber.svg`, `bazaar-mark-ink.svg`, `bazaar-mark-white.svg`. **Recolor the mark only in amber / ink / white** — never anything else, and never add gradients, gloss, or shadow.

### Substitutions flagged
- **Fonts** (Space Grotesk, Inter, JetBrains Mono) are all open-source Google Fonts, loaded via the **Google Fonts CDN** in `colors_and_type.css` (`@import`) — no local TTFs were bundled. If you need offline/embedded fonts, download these three families and drop them in a `fonts/` folder, then swap the `@import` for `@font-face` rules. Flagging in case you want them vendored.

---

## Index — what's in this folder

| Path | What it is |
|---|---|
| `README.md` | This file — product context, content + visual foundations, iconography, index. |
| `SKILL.md` | Agent-Skills-compatible entry point (works in Claude Code). |
| `colors_and_type.css` | All design tokens as CSS vars (color, type, radii, spacing, motion) + semantic element styles. The thing to import. |
| `assets/` | Brand marks, app icon, lockup, and the four persona sigil tiles (SVG + PNG). |
| `preview/` | Small specimen cards that populate the Design System tab (colors, type, personas, components, logos). |
| `ui_kits/arena/` | **The UI kit** — a high-fidelity, interactive recreation of the Arena frontend (Hub, Live Match, Ladder, Mint) in React/JSX, with reusable components. Open `ui_kits/arena/index.html`. |

> No slide template was supplied in the source, so no `slides/` deck was generated. Ask if you'd like a Bazaar-branded deck template built from these foundations.
