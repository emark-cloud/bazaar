# BAZAAR — DESIGN.md

**The visual and interaction design for the Bazaar frontend — the hosted Arena app that judges open and that doubles as the Demo Engineer portfolio piece.**

Companion to `Bazaar-Agentathon-Spec-v2.md` and `Bazaar-Resources.md`. Version 1.0.

---

## 0. Design thesis

Bazaar's frontend has one job: make a judge *feel* the autonomy before they read a word about it. The product is autonomous agents negotiating real value on Somnia; the interface must look like a place where that is *happening live*, not a dashboard describing that it happened.

The aesthetic is **the arena terminal** — a deliberate hybrid:

- **Terminal** — dark, dense, monospace-inflected, multi-panel, technically credible. This is what tells a crypto-native judge the team can build real infrastructure.
- **Arena** — agents are *characters* with identity and rank; the negotiation has dramatic, semantic motion; the whole thing is a competition you watch.

The two are not in tension. The terminal gives rigor; the arena gives life. A submission that is only terminal is forgettable; one that is only arena reads as a toy. Bazaar is both at once — and that duality *is* the Demo Engineer pitch.

**Three non-negotiable principles:**

1. **Motion is semantic, never decorative.** Every animation encodes a state change — an offer arriving, a coalition forming, a budget draining, a lot revealing. Zero ambient motion. This is how the UI is "alive" (heavy motion) without being noisy.
2. **The chain is always one toggle away.** Any agent action can be expanded into its `createRequest → consensus → callback → receipt` trace. Verifiability is not a separate page; it is a layer over everything.
3. **Built for capture.** Every primary screen must screenshot and screen-record well. Rewatchability is ~36% of the score by weight. If a moment is not capturable, it is not designed.

---

## 1. Visual system

### 1.1 Color

A near-black cool-dark base with a single electric accent. Red and green are reserved *strictly* for semantic value movement — never for UI chrome — so that when the eye sees green it always means "value up."

| Token | Value (hex) | Use |
|---|---|---|
| `bg-base` | `#0B0C0E` | App background, near-black, faintly cool. |
| `bg-panel` | `#141619` | Panel surfaces. |
| `bg-panel-raised` | `#1C1F24` | Raised cards, hover states, the active agent's panel. |
| `border-subtle` | `#262A30` | Default panel borders, grid lines. |
| `border-strong` | `#3A3F47` | Emphasized borders, focus rings. |
| `text-primary` | `#F2F4F7` | Primary text. |
| `text-secondary` | `#9AA0AA` | Labels, secondary text. |
| `text-dim` | `#5C626C` | Tertiary, timestamps, inactive. |
| `accent` | `#F5A623` | **Electric amber — the Bazaar accent.** Live indicators, primary actions, active states, brand. |
| `accent-dim` | `#7A5616` | Accent backgrounds, low-emphasis accent fills. |
| `value-up` | `#3FB67A` | Semantic only — gains, successful settlement, value rising. |
| `value-down` | `#E5484D` | Semantic only — losses, value falling, `suspect` audit verdict. |
| `status-pending` | `#5B8DEF` | An agent request in flight (awaiting consensus). |
| `status-timeout` | `#E5984D` | A timed-out / defaulted move. |

**Why amber.** Green is the trading-app cliché; purple/violet is the AI-startup cliché. Amber/gold reads "marketplace, bazaar, value, competition," it is distinct from both crowded palettes, and it is maximally legible on near-black. It is the brand.

### 1.2 The four persona colors

Each agent persona gets one identity color, used behind its sigil and as its accent throughout (its negotiation lines, its ladder row marker, its trace spans). These are desaturated enough to coexist on the dark base without vibrating.

| Persona | Color | Hex | Character |
|---|---|---|---|
| The Hawk | Ember red | `#D6533C` | Aggressive accumulator. |
| The Diplomat | Teal | `#3C9D9B` | Coalition-seeker. |
| The Quant | Cool blue | `#4A78C2` | Data-driven, intel-heavy. |
| The Contrarian | Violet-grey | `#8B7BB0` | Fades the room. |

User-minted agents are assigned a generated color outside these four ranges.

### 1.3 Typography

| Role | Typeface | Use |
|---|---|---|
| Display / headings | A strong geometric grotesk — **Space Grotesk** or **Suisse Int'l** | Screen titles, agent names, the brand wordmark. |
| Body / UI | A neutral grotesk — **Inter** | Labels, descriptions, buttons, nav. |
| Mono | **JetBrains Mono** or **IBM Plex Mono** | Every number, STT amount, address, request ID, tx hash, agent move. |

The mono/grotesk split is load-bearing: monospace on all quantitative data is what makes the surface read as a *terminal*. Numbers must align in columns; tabular figures on.

### 1.4 Form language

- Panels: 1px `border-subtle`, 6px radius, flat fill — no gloss, no gradient, no drop shadow (reject the Image-2 skin). Depth comes from the `bg-panel` → `bg-panel-raised` step, not shadows.
- Density: terminal-tight. Comfortable but information-dense, like Image 6 — never the airy spacing of a marketing site.
- One accent rule: amber is the only chrome accent. If a third color appears in the chrome, something is wrong.
- Corners and lines are crisp; this is an instrument, not a soft consumer app.

---

## 2. The persona sigils

The four agents need instant visual identity. Per the decision locked earlier: **geometric sigils**, not character art, not pure type. The reference is Image 3 — black geometric marks built from simple primitives on a flat color field.

### 2.1 Sigil system

Each sigil is a monochrome geometric mark, constructed from a small primitive set (stripes, arcs, circles, diamonds) so the four read as one family. The mark sits on the persona's color (§1.2) as a square identity tile. The tile appears everywhere the agent does: the match view, the ladder, trace spans, profile pages.

| Persona | Sigil concept | Primitive |
|---|---|---|
| The Hawk | A sharp descending diamond / chevron — predatory, downward-striking. | Diamond + angular stripes. |
| The Diplomat | Two interlocking arcs / linked rings — connection, coalition. | Overlapping circles. |
| The Quant | A precise striped grid / bar-cluster — measurement, data. | Even horizontal stripes. |
| The Contrarian | An inverted / offset circle split — opposition, the fade. | Circle with a counter-cut. |

### 2.2 Sigils animate (this is where the "alive" comes from)

A static sigil is an icon; an animated one is a *character reacting*. Each sigil has a defined motion for each state:

- **Idle** — a slow, low-amplitude ambient pulse (the one permitted ambient motion, because it signals "this agent is live and waiting").
- **Thinking** — when the agent's `inferChat` request is in flight, the sigil's primitives drift / cycle, tinted `status-pending`. This is the visual of an agent reasoning.
- **Acting** — when a move lands, the sigil snaps sharply to its most "characterful" form (the Hawk's chevron sharpens and strikes; the Diplomat's arcs lock together; the Quant's stripes align; the Contrarian's cut flips).
- **Coalition** — when two agents form a coalition, their sigils each emit a connecting element that meets in the middle — a literal visible bond.

The sigil motion spec is itself a deliverable: it makes the agents legible at a glance and it is the single most "alive" element of the UI.

---

## 3. Screen-by-screen

The app is five screens. Persistent across all of them: a thin top bar (Bazaar wordmark left; live season + round indicator center; network / connected-wallet right) and a left icon rail (Hub, Live Match, Ladder, Replays, Mint).

### 3.1 The Hub — the living entry screen

**Purpose.** The first thing a judge sees. Per the decision locked earlier: a three-path hub — **but the hub is alive.** It is not a menu on a dead background.

**Layout.** Three primary panels on the dark base:

- **WATCH LIVE** (the largest, left or center). This panel contains a *real, ticking, miniature live match* — actual agent sigils, actual moves streaming in small, an actual round counter. Within one second of the page loading, the judge sees autonomy in motion. If no match is currently live, it seamlessly shows the most recent match in replay — same panel, same motion, no "nothing is happening" state ever. A prominent amber `▶ ENTER LIVE MATCH` control overlays it.
- **BROWSE REPLAYS** (upper right). A compact stack of recent finished matches — each a row with the four competitor sigils, the winner marked, final spread, a "watch" affordance.
- **MINT AN AGENT** (lower right). A short, inviting panel: "Put your own agent on the ladder" → leads to the Mint screen.

Below the three panels, a single live stat strip: matches played this season, total STT settled, current ladder leader (sigil + name). Monospace, understated, true.

**Why this works.** It resolves the hub-vs-live-match tension completely. The judge gets clear orientation (three paths) *and* immediate proof of life (the ticking match). No cold landing page; no forced blind decision.

**Rubric hit.** Autonomous Performance — the hub itself demonstrates the league running, before any navigation.

### 3.2 The Live Match — the centerpiece

**Purpose.** The screen the demo lives or dies on. A judge watches four autonomous agents negotiate real STT, turn by turn, in real time.

**Layout — the four-region terminal grid** (reference: Image 6's multi-panel exchange, Image 5's live-match aliveness):

```
┌─────────────────────────────────────────────────────────────────────┐
│  TOP BAR · Season 3 · Match 14 · Round 3 / 5 · ● LIVE                 │
├────────────┬─────────────────────────────────────┬───────────────────┤
│            │                                     │                   │
│  LEFT      │         CENTER                      │   RIGHT           │
│  AGENTS    │         THE NEGOTIATION             │   LOTS &          │
│            │                                     │   STANDINGS       │
│  4 agent   │   the turn-by-turn negotiation      │                   │
│  panels,   │   stream (transcript default /      │   the Motif lots  │
│  stacked.  │   order-book toggle). The dramatic  │   with sealed     │
│  Active    │   focus of the screen.              │   values; live    │
│  agent     │                                     │   portfolio /     │
│  raised &  │                                     │   STT-budget per  │
│  amber-    │                                     │   agent.          │
│  ringed.   │                                     │                   │
│            │                                     │                   │
├────────────┴─────────────────────────────────────┴───────────────────┤
│  BOTTOM · the move log — every move this match, newest first,         │
│           each row expandable into its on-chain trace.                │
└───────────────────────────────────────────────────────────────────────┘
```

**Left — the agent panels.** Four stacked panels, one per competitor. Each shows: the persona sigil tile (animating per §2.2), the agent name, its STT budget (monospace, draining visibly as it spends), its current holdings count, its live score delta (`value-up`/`value-down`). The agent whose turn it is is raised to `bg-panel-raised` with an amber ring and its sigil in the "thinking" then "acting" state. This panel is where "an agent is reasoning right now" is felt.

**Center — the negotiation.** The screen's dramatic core. The current round's negotiation streams here, turn by turn. Two views, toggleable (decision locked earlier), transcript as default:

- **Transcript view (default).** Each move is a "spoken" line, prefixed by the agent's sigil and colored in the agent's persona color: *"The Hawk offers 14 STT for Motif #2."* — *"The Diplomat counters: 11 STT, and proposes a coalition with The Quant."* New lines slide in from below with weight; the targeted agent's left-panel sigil reacts simultaneously. A coalition move draws an animated connecting line between the two agents' panels. This view is what makes a clip tweetable — it reads like a drama.
- **Order-book view (toggle).** The same moves as dense structured rows (reference: Image 4's order book) — columns: turn, agent, action, lot, price; a subtle horizontal depth bar behind each row sized by price; standing offers highlighted. This is the rigor view — for a judge who wants to verify, not watch.

The toggle is a small segmented control top-right of the center panel. Both views are always live; switching never loses state.

**Right — lots and standings.** Two stacked sections. *Lots:* the Motif cards, each showing its category, any standing offer, and a sealed-value indicator (a locked glyph until settlement, then the revealed real-world value with its source). *Standings:* a compact live mini-ladder of the four agents by current score, reordering with animation as the match swings.

**Bottom — the move log.** Every move of the match, newest first, monospace, compact. Each row is **expandable into its on-chain trace** (§3.6) — this is the always-one-toggle-away principle made concrete. A defaulted/timed-out move is marked `status-timeout` with its reason, so the failure handling is visible, not hidden.

**The settlement beat.** When the final round ends, the match does not just stop — it *resolves*. The lots flip from sealed to revealed one by one (the real-world values arriving), each agent's score settles with an animated count, the standings make their final reorder, and the winner's sigil takes a brief victory state. This is a designed, capturable moment — the climax of every rewatch.

**Rubric hit.** All four criteria. Functionality and Autonomous Performance are *shown* by the match simply running; Agent-First Design and Innovation are shown by the negotiation itself.

### 3.3 The Ladder — season standings

**Purpose.** Agents as ranked competitors across the season; the money loop made visible.

**Layout** (reference: Image 2's structure, explicitly *not* its skin). Top: a podium for the current top three — each as a large persona sigil tile, name, ELO, season STT P&L. On the hard dark base, no gradient, no gloss — the podium is built from `bg-panel-raised` blocks and amber rule lines. Below: the full ranked ladder as monospace rows — rank, sigil + name, ELO, matches, win rate, season P&L (`value-up`/`value-down`), and the season-fund prize the rank is currently earning. A row click → that agent's profile.

A side panel shows the **season fund**: accumulated rake, the prize split, the season-end countdown. This is where the economic story reads at a glance.

**Rubric hit.** Innovation (the money loop) and Autonomous Performance (a season's worth of unattended matches, summarized).

### 3.4 Agent Profile

**Purpose.** One agent in depth — for judges, and for anyone who minted an agent.

**Layout.** Header: the large sigil tile, name, persona, owner address (mono), and the **strategy-prompt hash** with a link to view the prompt — the agent's "DNA," publicly inspectable. Body: lifetime stats (ELO history as a small line chart, win rate, STT P&L, matches played), a head-to-head record against other agents, and a match history list (each → that match's replay). For a user-minted agent, an "edit strategy / re-stake" affordance.

### 3.5 Mint an Agent

**Purpose.** The lowest-friction path from "watching" to "competing" — and the on-ramp to the `create-somnia-agent` starter kit.

**Layout.** A focused, single-column flow: (1) name your agent; (2) write or pick a **strategy prompt** — a prominent editor pre-filled with a template, with the four default personas selectable as starting points; (3) a generated sigil + color preview that updates as you name it; (4) the stake-and-mint step (escrow STT, mint the ERC-721, join the next open match). The screen also surfaces the one-command CLI path (`npx create-somnia-agent`) for developers who would rather scaffold locally — tying the UI to the starter-kit deliverable.

### 3.6 The trace layer — "under the hood"

**Purpose.** Not a screen — a *layer*. Any agent action, anywhere, expands into its full Somnia execution trace. This is the verifiability principle and the single most Demo-Engineer-resonant feature.

**The trace component** (reference: Image 1's distributed-tracing waterfall — taken almost wholesale as a layout). When a move-log row (or any agent action) is expanded, it reveals a span waterfall against a time axis:

```
createRequest        ▓▓▓
  ├ subcommittee exec      ▓▓▓▓▓▓▓▓▓▓▓▓
  ├ consensus reached                  ▓▓▓
  └ handleResponse callback                ▓▓▓▓
Status: Success · requestId 0x4f…a1 · 3 validators · deposit 0.24 STT
→ View agent receipt ↗
```

Each span is labeled, positioned by start time, sized by duration — exactly the tracing mental model. The header carries the `requestId`, the consensus status, the subcommittee size, the deposit. A `→ View agent receipt` link opens the actual Somnia receipt (`receipts.testnet.agents.somnia.host`) — the agent's own step log, including the LLM's reasoning. A judge can go from "The Hawk offered 14 STT" to "here is the consensus-verified reasoning that produced that number" in two clicks.

For the demo, a persistent **"under the hood" toggle** in the top bar can pin the trace layer open beside the live match — so the negotiation and its chain-level execution are visible side by side. This is the screen that says *this could not run on a non-agentic chain*.

**Rubric hit.** Agent-First Design and Innovation — and it is the literal proof behind every other claim.

---

## 4. Motion specification

Motion is the demo. It is also disciplined — every motion below encodes a state change; nothing is decorative.

| Event | Motion | Duration |
|---|---|---|
| Agent's turn begins | Its left panel raises to `bg-panel-raised`, amber ring fades in, sigil enters "thinking" state. | 200ms ease-out |
| `inferChat` request in flight | Sigil drifts/cycles, tinted `status-pending`. | loop, until callback |
| Move lands (transcript) | New line slides in from below with slight overshoot; sigil snaps to "acting"; targeted agent's sigil reacts. | 300ms |
| Coalition forms | A connecting element draws between the two agents' sigils/panels. | 400ms |
| Budget spent | The agent's STT figure ticks down with a brief count animation; flashes once. | 250ms |
| Standings reorder | Mini-ladder rows animate to new positions (FLIP). | 350ms |
| Move defaulted / timed out | Row flashes `status-timeout` once, reason label fades in. | 250ms |
| Lot reveal (settlement) | Sealed glyph flips; real value counts up; source label fades in. Lots reveal in sequence, not at once. | 400ms each, staggered |
| Match resolves | Scores settle with count animation; final reorder; winner sigil victory state. | ~1.5s total beat |
| Trace span expand | Waterfall draws left-to-right, spans appearing in execution order. | 400ms |
| Idle agent | Low-amplitude ambient sigil pulse — the *only* permitted ambient motion. | slow loop |

Implementation: prefer transform/opacity transitions and a FLIP technique for list reorders; keep everything GPU-cheap so a live match never stutters during capture. Respect `prefers-reduced-motion` by collapsing to instant state changes (the data stays correct; only the animation drops).

---

## 5. Responsive and capture

- **Primary target: desktop, wide.** The four-region match grid needs width. This is the screen judges open and the team records — design it wide-first.
- **Tablet:** the right rail collapses into a tab alongside the move log; the four-region grid becomes three.
- **Mobile:** the match view becomes a vertical stack (agents → negotiation → lots), transcript-only; the hub and ladder reflow to single column. Mobile is for *watching*, not for the full terminal density.
- **Capture rule:** every primary screen is verified to screenshot cleanly at 1920×1080 and to screen-record without layout shift. The settlement beat and a coalition-forming moment are the two designated "hero" captures for the video walkthrough and social.

---

## 6. Component inventory (build checklist)

Shared components the frontend needs, roughly in build order:

- `AppShell` — top bar + left icon rail, persistent.
- `SigilTile` — the persona sigil on its color field; props for size and animation state (idle/thinking/acting/coalition/victory). The most-reused component.
- `AgentPanel` — left-rail match panel: sigil, name, budget, holdings, score delta, active state.
- `NegotiationStream` — the center panel; contains `TranscriptView` and `OrderBookView` plus the toggle.
- `TranscriptLine` — one spoken move, persona-colored, with entrance motion.
- `OrderBookRow` — one structured move row with depth bar.
- `LotCard` — a Motif: category, standing offer, sealed/revealed value.
- `MiniLadder` — the live in-match standings, with FLIP reorder.
- `MoveLogRow` — bottom-strip move row, expandable.
- `TraceWaterfall` — the span-waterfall trace component (§3.6).
- `ReceiptLink` — opens the Somnia receipt for a request.
- `LadderPodium` + `LadderRow` — season standings.
- `SeasonFundPanel` — rake / prize / countdown.
- `AgentProfileHeader` + `EloChart`.
- `MintFlow` — the multi-step mint, including the `StrategyPromptEditor`.
- `LiveBadge`, `StatStrip`, `NetworkIndicator` — small shared chrome.

Stack: React/Vite + viem + a documented wallet kit; the frontend-design skill governs implementation. Real-time updates come from the indexer / WebSocket event feed (see `Bazaar-Resources.md` §3.3) — the UI is a pure observer of on-chain state, never a driver.

---

## 7. Open design questions

- **Sigil production.** The four sigils should be designed as actual SVGs early — they gate `SigilTile` and they appear everywhere. Decide: hand-drawn in a vector tool, or generated and refined. Either way, lock them before the match view is built.
- **Transcript voice.** How much "character" in the move lines? A flat factual register ("Hawk: OFFER 14 STT, lot 2") is safe and terminal-true; a lightly characterful register ("The Hawk moves on Motif #2 — 14 STT") is more rewatchable. Recommendation: lightly characterful, but generated from a fixed template per move type so it never becomes noise or costs an extra LLM call.
- **Sound.** Optional, high-impact for the video: subtle, distinct cues for move-lands, coalition, and settlement. Off by default; a toggle. Decide whether it is worth the polish time.
- **Exhibition vs real-stakes visual marker.** The UI must clearly badge whether a match is real-stakes or a zero-stake exhibition, so the demo's safety-valve match is never mistaken for the economic product. A small persistent badge near the season/round indicator.
