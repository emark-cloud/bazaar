// SigilTile.jsx — the persona sigil on its color field. The most-reused component.
// Faithful recreation of frontend/src/sigils/SigilGlyph.tsx + SigilTile.tsx.
// States: idle | thinking | acting | coalition | victory.

const PERSONA_COLOR = {
  hawk: "#D6533C",
  diplomat: "#3C9D9B",
  quant: "#4A78C2",
  contrarian: "#8B7BB0",
  generic: "#7A5616",
};

const PERSONA_LABEL = {
  hawk: "The Hawk",
  diplomat: "The Diplomat",
  quant: "The Quant",
  contrarian: "The Contrarian",
  generic: "User Agent",
};

const PERSONA_TEMPLATE = {
  hawk: "Be aggressive. Buy high-conviction lots early. Take coalition only if it widens lead.",
  diplomat: "Coalition-first. Trade lower per-lot profit for stability. Accept allies generously.",
  quant: "Data-driven. Bid only when expected value clears a safety margin; otherwise PASS.",
  contrarian: "Fade the room. Target lots no one is bidding on. Avoid bidding wars.",
  generic: "Maximize end-of-match score. Score = (true lot value / divisor) - paid price.",
};

function nameToPersona(name) {
  const n = (name || "").trim().toLowerCase().replace(/^the\s+/, "");
  if (n.startsWith("hawk")) return "hawk";
  if (n.startsWith("diplomat")) return "diplomat";
  if (n.startsWith("quant")) return "quant";
  if (n.startsWith("contrarian")) return "contrarian";
  return "generic";
}

function generatedColorFor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const palette = ["#7A5616", "#6F5A2C", "#446A8F", "#5C7B6F", "#8F5C5C", "#6B5C8F"];
  return palette[h % palette.length];
}

// Inner glyph paths only — viewBox 0 0 64 64. Ink-on-color.
function SigilGlyph({ persona, stroke = "#16181C" }) {
  switch (persona) {
    case "hawk":
      return (
        <g stroke={stroke} strokeWidth="2.5" strokeLinejoin="miter" fill={stroke}>
          <polygon points="32,12 50,32 32,52 14,32" />
          <line x1="22" y1="38" x2="42" y2="38" strokeWidth="2.5" />
          <line x1="26" y1="44" x2="38" y2="44" strokeWidth="2.5" />
        </g>
      );
    case "diplomat":
      return (
        <g fill="none" stroke={stroke} strokeWidth="3">
          <circle cx="25" cy="32" r="14" />
          <circle cx="39" cy="32" r="14" />
        </g>
      );
    case "quant":
      return (
        <g fill={stroke}>
          <rect x="14" y="16" width="36" height="4" />
          <rect x="14" y="24" width="36" height="4" />
          <rect x="14" y="32" width="36" height="4" />
          <rect x="14" y="40" width="36" height="4" />
          <rect x="14" y="48" width="36" height="4" />
        </g>
      );
    case "contrarian":
      return (
        <g fill="none" stroke={stroke} strokeWidth="3">
          <circle cx="32" cy="32" r="18" />
          <line x1="14" y1="46" x2="50" y2="18" />
        </g>
      );
    default:
      return (
        <g fill="none" stroke={stroke} strokeWidth="3">
          <polygon points="32,14 50,32 32,50 14,32" />
          <circle cx="32" cy="32" r="4" fill={stroke} />
        </g>
      );
  }
}

function SigilTile({ name, size = 56, state = "idle", ring = false }) {
  const persona = nameToPersona(name);
  const bg = persona === "generic" ? generatedColorFor(name) : PERSONA_COLOR[persona];

  const animClass =
    state === "thinking" ? "bz-anim-thinking"
    : state === "acting" ? "bz-anim-strike"
    : state === "victory" ? "bz-anim-victory"
    : "bz-anim-pulse";

  return (
    <div
      className="bz-sigil"
      style={{
        width: size, height: size, backgroundColor: bg,
        boxShadow: ring ? "0 0 0 2px #F5A623, 0 0 0 4px #0B0C0E" : "none",
        opacity: state === "thinking" ? 0.92 : 1,
      }}
      title={name}
      aria-label={name}
    >
      <svg
        viewBox="0 0 64 64"
        width={size * 0.78}
        height={size * 0.78}
        className={animClass}
        style={{ transformOrigin: "center" }}
      >
        <SigilGlyph persona={persona} />
      </svg>
      {state === "coalition" && <span className="bz-sigil-bond" aria-hidden="true"></span>}
    </div>
  );
}

Object.assign(window, {
  SigilTile, SigilGlyph, nameToPersona, generatedColorFor,
  PERSONA_COLOR, PERSONA_LABEL, PERSONA_TEMPLATE,
});
