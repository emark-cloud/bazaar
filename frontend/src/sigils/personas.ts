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

/** Map a registered agent NAME (case-insensitive) to a persona. Unknown names → generic. */
export function nameToPersona(name: string): Persona {
  const n = name.trim().toLowerCase();
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
