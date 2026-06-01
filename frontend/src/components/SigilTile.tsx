import { SigilGlyph } from "../sigils/SigilGlyph";
import { PERSONA_COLOR, generatedColorFor, nameToPersona, type Persona } from "../sigils/personas";

export type SigilState = "idle" | "thinking" | "acting" | "coalition" | "victory";

export function SigilTile({
  name,
  size = 56,
  state = "idle",
  ring = false,
}: {
  name: string;
  size?: number;
  state?: SigilState;
  ring?: boolean;
}) {
  const persona: Persona = nameToPersona(name);
  const bg = persona === "generic" ? generatedColorFor(name) : PERSONA_COLOR[persona];

  const animClass =
    state === "thinking" ? "animate-sigil-thinking"
    : state === "acting" ? "animate-sigil-strike"
    : state === "victory" ? "animate-sigil-victory"
    : "animate-sigil-pulse";

  const ringClass = ring
    ? "ring-2 ring-accent ring-offset-2 ring-offset-bg-base"
    : "";

  const tinted = state === "thinking" ? "opacity-90" : "";

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-sm select-none ${ringClass} ${tinted}`}
      style={{ width: size, height: size, backgroundColor: bg }}
      aria-label={name}
      title={name}
    >
      <svg
        viewBox="0 0 40 40"
        width={size * 0.78}
        height={size * 0.78}
        className={animClass}
        style={{ transformOrigin: "center" }}
      >
        <SigilGlyph persona={persona} />
      </svg>
      {state === "coalition" && (
        <span
          className="absolute -right-2 top-1/2 h-px w-2 -translate-y-1/2 bg-accent"
          aria-hidden
        />
      )}
    </div>
  );
}
