import type { Persona } from "./personas";

/**
 * Inline SVG geometric sigils — one mark per persona, drawn from minimal primitives.
 * Returns the inner path/shape only (no <svg> wrapper), so SigilTile owns the viewBox + animation.
 */
export function SigilGlyph({ persona, stroke = "#0B0C0E" }: { persona: Persona; stroke?: string }) {
  switch (persona) {
    case "hawk":
      // Descending diamond + angular stripes — predatory.
      return (
        <g stroke={stroke} strokeWidth="2.5" strokeLinejoin="miter" fill={stroke}>
          <polygon points="32,12 50,32 32,52 14,32" />
          <line x1="22" y1="38" x2="42" y2="38" stroke={stroke} strokeWidth="2.5" />
          <line x1="26" y1="44" x2="38" y2="44" stroke={stroke} strokeWidth="2.5" />
        </g>
      );
    case "diplomat":
      // Two interlocking circles — coalition.
      return (
        <g fill="none" stroke={stroke} strokeWidth="3">
          <circle cx="25" cy="32" r="14" />
          <circle cx="39" cy="32" r="14" />
        </g>
      );
    case "quant":
      // Striped bar-cluster — measurement.
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
      // Circle split with counter-cut — the fade.
      return (
        <g fill="none" stroke={stroke} strokeWidth="3">
          <circle cx="32" cy="32" r="18" />
          <line x1="14" y1="46" x2="50" y2="18" />
        </g>
      );
    case "generic":
    default:
      // Amber diamond outline — user-minted default.
      return (
        <g fill="none" stroke={stroke} strokeWidth="3">
          <polygon points="32,14 50,32 32,50 14,32" />
          <circle cx="32" cy="32" r="4" fill={stroke} />
        </g>
      );
  }
}
