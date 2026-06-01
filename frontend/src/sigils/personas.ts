export type Persona = "hawk" | "diplomat" | "quant" | "contrarian" | "generic";

export const PERSONA_COLOR: Record<Persona, string> = {
  hawk:       "#D6533C",
  diplomat:   "#3C9D9B",
  quant:      "#4A78C2",
  contrarian: "#8B7BB0",
  generic:    "#7A5616",
};

export const PERSONA_LABEL: Record<Persona, string> = {
  hawk:       "The Hawk",
  diplomat:   "The Diplomat",
  quant:      "The Quant",
  contrarian: "The Contrarian",
  generic:    "User Agent",
};

/**
 * Map a registered agent NAME (case-insensitive) to a persona. Unknown names → generic.
 *
 * Tolerates a leading "The " so display labels ("The Hawk") resolve the same as
 * ladder names ("Hawk-Prime"). Without this strip, every "The …" label falls
 * through to `generic` and the Mint persona grid renders one sigil/color for all.
 */
export function nameToPersona(name: string): Persona {
  const n = (name ?? "").trim().toLowerCase().replace(/^the\s+/, "");
  if (n.startsWith("hawk"))       return "hawk";
  if (n.startsWith("diplomat"))   return "diplomat";
  if (n.startsWith("quant"))      return "quant";
  if (n.startsWith("contrarian")) return "contrarian";
  return "generic";
}

/** Stable color seed for non-default agents (Judges, user-minted). */
export function generatedColorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  // Pull from amber-adjacent / cool spectrum, not the four persona colors.
  const palette = ["#7A5616", "#6F5A2C", "#446A8F", "#5C7B6F", "#8F5C5C", "#6B5C8F"];
  return palette[h % palette.length];
}

/**
 * The single accent color for an agent surface — its `--p` custom property.
 * Named personas use their fixed color; generic/user-minted agents get a stable
 * hash → muted palette. This is the one identity color used app-wide (1–2px
 * rules + the sigil tile), never as a fill.
 */
export function personaColorOf(name: string): string {
  const persona = nameToPersona(name);
  return persona === "generic" ? generatedColorFor(name) : PERSONA_COLOR[persona];
}

/** One- to two-sentence "projected play style" per persona — for Mint + dossier readouts. */
export const PERSONA_TRAIT: Record<Persona, string> = {
  hawk:       "Opens fast and accumulates high-conviction lots. Rarely passes; takes coalitions only when they widen a lead.",
  diplomat:   "Coalition-first. Trades per-lot profit for stable partnerships and steady, low-variance finishes.",
  quant:      "Bids strictly on expected value. Passes freely when the margin isn't there — patient, disciplined.",
  contrarian: "Fades the room. Targets lots no one is bidding and avoids bidding wars to find quiet value.",
  generic:    "Balanced baseline. Maximizes end-of-match score with no strong stylistic bias — a clean slate to tune.",
};
