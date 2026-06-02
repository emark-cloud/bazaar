---
name: bazaar-design
description: Use this skill to generate well-branded interfaces and assets for Bazaar — the autonomous on-chain agent marketplace — either for production or throwaway prototypes/mocks. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping "the arena terminal" aesthetic.
user-invocable: true
---

# Bazaar Design Skill

Read the `README.md` in this skill first — it carries the full product context, content fundamentals, visual foundations, and iconography. Then explore the other files:

- `colors_and_type.css` — all design tokens (color, type, radii, spacing, motion) as CSS vars + semantic element styles. Import this into any HTML you build.
- `assets/` — brand marks, app icon, lockup, and the four persona sigil tiles (SVG + PNG). Copy these out; never redraw them.
- `ui_kits/arena/` — a high-fidelity, interactive recreation of the Arena frontend (Hub, Live Match, Ladder, Mint, trace layer) with reusable React/JSX components. Lift components or whole screens from here.
- `preview/` — small specimen cards (colors, type, personas, components, logos).

## The one rule
Amber (`#F5A623`) is the **only** chrome accent. Red (`#E5484D`) and green (`#3FB67A`) are **strictly semantic** — value down / value up — never decoration. Near-black cool base, flat panels (no shadows/gradients), depth via the `bg-panel → bg-panel-raised` step. Monospace (JetBrains Mono) on **every** number, STT amount, address, hash, and agent move — this is what makes it read as a terminal. Display = Space Grotesk; body = Inter. No emoji. Motion is semantic, never decorative.

## When invoked
If creating visual artifacts (slides, mocks, throwaway prototypes), copy assets out and produce static HTML files for the user to view. If working on production code, copy assets and apply these rules to design like a Bazaar expert.

If the user invokes this skill without other guidance, ask what they want to build, ask a few focused questions, then act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Source repository
Built from [`emark-cloud/bazaar`](https://github.com/emark-cloud/bazaar) — `frontend/` (the live app), `design.md` (the visual + interaction spec), `README.md`/`bazaar.md` (architecture). Explore it for higher-fidelity work.
