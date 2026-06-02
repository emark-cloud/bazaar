# Arena UI Kit — Bazaar

A high-fidelity, interactive recreation of the **Bazaar Arena frontend** — the hosted app that judges open and that doubles as the demo. Faithful to the real source at [`emark-cloud/bazaar` → `frontend/`](https://github.com/emark-cloud/bazaar/tree/main/frontend) (Vite + React + Tailwind + viem). This kit is cosmetic/click-thru — it mocks on-chain reads with illustrative data — but the components, layout, type, color, and motion match the production app.

## Run it
Open `index.html`. No build step — React + Babel are loaded from CDN and the `.jsx` files are transpiled in-browser.

## What it covers (the five screens + trace layer)
- **Hub** (`Hub`) — the living entry screen: Watch-Live panel, mini-ladder, mint CTA, live stat strip.
- **Live Match** (`LiveMatch`) — the centerpiece four-region terminal grid. Moves stream in, a coalition forms, then the **settlement beat** reveals each lot's sealed value and scores settle. Toggle the center panel between **transcript** and **order book**; click any move to expand its **trace waterfall**.
- **Ladder** (`Ladder`) — podium + full ELO ladder + season-fund panel. Click any agent → profile.
- **Mint** (`Mint`) — name → pick persona / edit strategy prompt → live sigil preview → (fake) stake & mint.
- **Agent Profile** (`AgentProfile`) — an overlay opened from the ladder; sigil, prompt-hash DNA, lifetime stats.
- **Trace layer** (`TraceWaterfall`) — the `createRequest → consensus → callback → receipt` span waterfall, expandable under any move.

## Files
| File | Contents |
|---|---|
| `index.html` | Entry point. Loads React/Babel + all `.jsx`, mounts `<App>` with nav + profile overlay. |
| `arena.css` | All styling + the semantic keyframes (sigil pulse/think/strike, slide-up, lot-flip, fade). |
| `SigilTile.jsx` | `SigilTile`, `SigilGlyph`, the persona maps (`PERSONA_COLOR/LABEL/TEMPLATE`), `nameToPersona`. The most-reused component. |
| `data.jsx` | Mock on-chain state (`AGENTS`, `LOTS`, `MOVES`, `SEASON`) — shapes mirror `frontend/src/chain/types.ts`. |
| `components.jsx` | `AppShell`, `AgentPanel`, `LotCard`, `MiniLadder`, `NegotiationStream`, `TranscriptLine`, `TraceWaterfall`. |
| `screens.jsx` | `Hub`, `LiveMatch`, `Ladder`, `Mint`, `AgentProfile`. |

## Conventions (so components compose)
- Each `.jsx` is its own Babel scope; shared symbols are exported via `Object.assign(window, {...})` at the file's end. Load order in `index.html` matters: SigilTile → data → components → screens.
- `bigint` is used for ids / STT / scores, matching the chain types.
- Persona is derived from an agent's **name** (`nameToPersona`): names starting `hawk`/`diplomat`/`quant`/`contrarian` get that identity color; anything else is a generated amber-adjacent "generic" color. (Note: the Mint persona buttons pass the `PERSONA_LABEL` "The Hawk" etc., which resolves to generic — this mirrors the source.)
- Motion is semantic: classes `bz-anim-*` map 1:1 to the design.md motion spec. Everything respects `prefers-reduced-motion`.

## Not included
Real wallet/contract wiring, the indexer/event feed, and the AuditCouncil VRF flow are out of scope for a cosmetic kit — `Mint` simulates the tx with a timeout. Pull the real logic from `frontend/src/chain/*` in the repo when building production.
