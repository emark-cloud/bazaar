# Handoff: Bazaar Arena — UI Polish Pass

## Overview
This package documents a set of UI improvements for the **Bazaar Arena frontend** — the hosted app where four autonomous on-chain agents negotiate and settle live. The brief was "the UI looks a little bland." This pass makes it feel **alive and on-brand** without changing the architecture: a living-match hero, a dramatic settlement beat, a persona-color identity system applied app-wide, a live-morphing Mint preview, and a richer Agent Profile.

**You are porting these changes into the existing codebase**, not building from scratch.

## About the design files
The files in `reference/` are **design references built in HTML/React-via-Babel** — a high-fidelity, mostly-cosmetic recreation of the real app used to prototype the look and motion. **Do not copy them verbatim.** The production app already exists at **`emark-cloud/bazaar` → `frontend/`** (Vite + React + TypeScript + Tailwind + viem). Your job is to re-implement the improvements documented here inside that real codebase, using its existing components, types (`chain/types.ts`), and live on-chain reads. The reference files exist only to show intended pixels and behavior.

- Real repo: https://github.com/emark-cloud/bazaar
- Canonical design spec: `design.md` in that repo ("the arena terminal")
- Canonical tokens: `frontend/tailwind.config.js`

## Fidelity
**High-fidelity.** Colors, type, spacing, motion timings, and interactions are final. Recreate pixel-faithfully using the existing Tailwind tokens and component structure. The reference uses plain CSS (`arena.css`) with `--bz-*`-style custom properties; in the real app those map to the Tailwind theme already defined in `tailwind.config.js`.

---

## The core fix that underpins everything: persona resolution

The single most important code detail. Agent identity (sigil glyph + color) is derived from the agent's name via `nameToPersona()` in `frontend/src/sigils/personas.ts`. It must tolerate a leading **"The "** so that display labels like *"The Hawk"* resolve correctly (not just ladder names like *"Hawk-Prime"*):

```ts
export function nameToPersona(name: string): Persona {
  const n = (name ?? "").trim().toLowerCase().replace(/^the\s+/, "");
  if (n.startsWith("hawk")) return "hawk";
  if (n.startsWith("diplomat")) return "diplomat";
  if (n.startsWith("quant")) return "quant";
  if (n.startsWith("contrarian")) return "contrarian";
  return "generic";
}
```

Without the `replace(/^the\s+/, "")`, every "The …" label falls through to `generic` — which breaks the Mint persona grid (all cells render the same generic sigil and color). This one line fixes the glyph, the cell border color, the preview-card glow, and the preview label color simultaneously.

---

## Change-by-change spec (mapped to real files)

### 1. Persona color system — applied app-wide
**Files:** `personas.ts` (source of truth), then `AgentPanel.tsx`, `Ladder.tsx` podium, `Mint.tsx`.

Each agent surface gets a thin accent in its persona color, driven by a CSS custom property `--p` set inline from `personaColorOf(name)`:

```ts
export const PERSONA_COLOR = {
  hawk:       "#D6533C",  // ember red
  diplomat:   "#3C9D9B",  // teal
  quant:      "#4A78C2",  // cool blue
  contrarian: "#8B7BB0",  // violet-grey
  generic:    "#7A5616",  // amber-dim (user-minted default)
} as const;
// generic/user agents use a deterministic hash → muted palette (see personaColorOf)
```

- **AgentPanel:** `border-left: 2px solid var(--p)`. When it's the agent's turn, add `is-active` → inset amber 1px ring + soft amber outer glow.
- **Ladder podium:** each cell `border-top: 2px solid var(--p)`; the #1 cell additionally gets an amber glow (`box-shadow: 0 0 0 1px var(--accent), 0 8px 30px -14px rgba(245,166,35,.5)`).
- **Discipline rule (do not break):** amber `#F5A623` is the *only* chrome accent; red `#E5484D` / green `#3FB67A` are **semantic** (value down/up) only. Persona colors appear only as 1–2px identity rules + the sigil tile, never as fills.

### 2. Hub → "living match" hero
**File:** `screens/Hub.tsx` (+ a new `LiveMatchPreview` component).

Replace the near-empty "Watch Live" hero with a hero that *shows the autonomy*:
- Eyebrow: `● live now · match #14 · shannon testnet` (the `●` is an amber pulsing dot).
- Headline (Space Grotesk, ~40px, `letter-spacing:-.02em`): **"Four agents are negotiating right now."** with an amber period.
- A `LiveMatchPreview` block: 2×2 agent cards (sigil + budget, persona top-border, active card highlighted) on the left, a **live negotiation ticker** on the right (last 3 moves, newest fully opaque, older ones faded to .62/.34), and a row of 4 lot pips (`⌛ sealed` / `✓ sold`) below.
- In the reference it ticks on a timer for demo purposes. **In production, drive it from the same live `MoveMade` subscription / reads the real match uses** — don't add a fake interval. If no match is live, show the most recent replay or a calm idle state.
- CTA: amber `▶ ENTER LIVE MATCH` button with an amber glow shadow; sublabel "full board · transcript · one-click chain trace".
- A faint radial amber glow sits behind the hero (logo-stage style, top-left), and a ~2%-opacity terminal graph-grid texture covers the app background (`linear-gradient` 1px lines at 32px).

### 3. Live Match → states + rhythm + settlement beat
**Files:** `screens/LiveMatch.tsx`, `components/AgentPanel.tsx`, `components/NegotiationStream.tsx`, `sigils/SigilGlyph.tsx`.

- **Active agent:** breathing amber ring + a `thinking` indicator (the word + 3 animated dots) while that agent's inference is in flight. Maps to the existing per-turn / request-pending state.
- **Negotiation stream rhythm:** each move row shows persona-colored name, a monochrome **move-kind pill** (`OFFER`/`COUNTER`/`COALITION`/`PASS`; failures `REJECTED`/`DEFAULTED` take the timeout color), and a `req <id> · 3 validators` trace meta line. The newest row lands with a persona-tinted highlight + the slide-up-with-overshoot. Feed auto-scrolls to the latest row (set `scrollTop = scrollHeight`; **never** `scrollIntoView`).
- **Settlement beat** (on `Settled`/reveal): lot values flip and **count up** from 0 (easeOutCubic, ~700ms); agent scores tick up the same way (including the coalition 50/50 split); the winning agent gets a `♛` crown + victory sigil animation + amber winner-glow on its panel; a **settlement banner** spans the top: winner sigil + "<Agent> takes the pot" + the count-up net P&L, with audit verdict (Clean/Suspect). The winner must be the computed top-P&L agent, not hardcoded.
- **SigilGlyph** gains a `victory` state (a brief scale/rotate wobble loop).

### 4. Mint → live-morphing preview
**File:** `screens/Mint.tsx`.

- Persona grid: 5 cells, each with its persona top-border and, when selected, a persona-colored ring/glow + the sigil in a gentle `thinking` pulse. **Pass the persona key (or a canonical name) into the sigil/color helpers** — relying on the "The …" label only works because of the `nameToPersona` fix above.
- Preview card: persona-colored top border + a radial persona glow; the sigil **re-animates (a "strike") on every persona change and on prompt edits** (use a React `key` that includes the persona + an edit counter so it remounts). The persona label renders in the persona color; the name auto-fills from the persona unless the user has typed their own.
- A "projected play style" readout: 1–2 sentences describing how that persona plays.
- Prompt textarea hashes to the on-chain DNA hash shown beneath it (real app: `keccak256` of the prompt, already in `Mint.tsx`).

### 5. Agent Profile → dossier
**File:** `screens/AgentProfile.tsx`.

- Persona-colored 3px accent bar across the top of the overlay; persona-colored persona label.
- Lifetime stat row (elo / matches / wins / win-rate); elo value in amber.
- Two columns: an **ELO trajectory sparkline** (inline SVG polyline + faint fill + end dot, colored in the persona color; built from finalized-match elo history) and a **recent-matches table** — each row: W/L badge (green/red), `#match`, opponent sigil + "vs <name>", net STT P&L (green/red), elo delta (green/red).

---

## Design tokens (exact)
Mirror of `tailwind.config.js` / `colors_and_type.css` — use the Tailwind theme values in the real app.

**Color**
- Surfaces: base `#0B0C0E`, panel `#141619`, panel-raised `#1C1F24`
- Borders: subtle `#262A30`, strong `#3A3F47`
- Text: primary `#F2F4F7`, secondary `#9AA0AA`, dim `#5C626C`
- Accent (chrome, only): `#F5A623`; accent-dim `#7A5616`; ink-on-amber `#16181C`
- Semantic value: up `#3FB67A`, down `#E5484D`
- Status: pending `#5B8DEF`, timeout `#E5984D`
- Persona: hawk `#D6533C`, diplomat `#3C9D9B`, quant `#4A78C2`, contrarian `#8B7BB0`, generic `#7A5616`

**Type** — Display: Space Grotesk · Body/UI: Inter · Mono: JetBrains Mono (all numbers/addresses/ids in mono with `tabular-nums`). Scale: display 34–40, h1 24, h2 18, h3 15, body 14, sm 13, label 12, xs 10. Uppercase mono labels at `letter-spacing:.08em`.

**Radii** 2 / 6 / 12 / pill. **Spacing** 4pt base. **No drop shadows** on panels (depth = the surface step). One blur: top bar `bg-panel/60` + `backdrop-blur-sm`.

**Motion** — ease-out `cubic-bezier(0.16,1,0.3,1)`; slide-up has a slight overshoot. Durations: turn-begin 200, move-lands 300, coalition/reveal/trace 400, score-reorder (FLIP) 350, count-up ~700. Motion is **semantic only** — the one ambient motion is the slow sigil pulse ("live, waiting"). **Honor `prefers-reduced-motion`:** collapse to instant state changes, data stays correct.

## State (real app already has the shape)
Match phase (`None|Pricing|Negotiating|Settling|Resolved` per `chain/types.ts`), per-agent budget + computed score, lots (sealed → revealed value), move log (`MoveEntry[]`), active turn index, winner = max P&L. All of it should come from on-chain reads / event subscriptions exactly as today — this pass changes presentation, not data flow.

## Assets
Persona sigils are inline SVG (see `SigilGlyph.tsx` in the repo; recreated in `reference/SigilTile.jsx`). Brand marks live in the design system (`assets/`): `bazaar-mark-amber.svg`, `bazaar-lockup.svg`, app icon. Recolor marks only in amber/ink/white. No emoji anywhere; the only glyphs are functional Unicode (`● ▶ ♛ ◈ + ▸ ▾ ⌛ ✓ ✗ →`).

## Files in this bundle (`reference/`)
- `index.html` — entry; mounts the kit (open in a browser to see the target look/motion).
- `screens.jsx` — Hub, LiveMatch, Ladder, Mint, AgentProfile (+ EloSparkline, CountUp usage).
- `components.jsx` — AppShell, AgentPanel, NegotiationStream/TranscriptLine, LotCard, TraceWaterfall, MiniLadder, LiveMatchPreview, CountUp, personaColorOf.
- `SigilTile.jsx` — sigil glyphs + `nameToPersona` (note the `^the` fix) + persona color/label/trait maps.
- `data.jsx` — mock agents/lots/moves/match-history/elo-track (shapes mirror `chain/types.ts`; replace with live reads).
- `arena.css` — all styling + keyframes.
- `colors_and_type.css` — the token reference.

## Visual targets (`screenshots/`)
PNGs of the target design for four screens — use these as the pixel goal:
- `1-hub.png` — Hub with the living-match hero (headline, agent board, live ticker, lot pips).
- `2-live.png` — Live Match mid-negotiation: persona-colored transcript, move-kind pills, lot board, move-log strip. *(The left agent-panel column is omitted from this capture — see `index.html` live for the active/thinking states; they're spec'd in §3.)*
- `3-ladder.png` — Season ladder: amber #1 podium, ranked table, season-fund panel.
- `4-mint.png` — Mint flow with The Hawk selected, auto-filled name, strategy prompt, DNA hash, projected play style.

**Agent Profile** — open **`profile_preview.html`** in a browser (it renders the dossier inline using the bundled `reference/` files). It shows the persona accent bar, the ELO-trajectory sparkline, and the recent-matches table. *(Couldn't be saved as a clean PNG — the capture tool drops fixed-position overlays — so it's shipped as a live HTML preview instead.)*

> **Tip:** the fastest way to see all five screens with full motion is to open `reference/index.html` and click through the left rail (Hub / Live / Ladder / Mint), and open `profile_preview.html` for the profile.
