import type { Persona } from "./personas";

/**
 * Inline SVG geometric sigils — one mark per persona, drawn from minimal
 * primitives. Geometry is the canonical brand-kit set (bazaar-brand-kit/sigils),
 * authored in a 0 0 40 40 box. Returns the inner shapes only (no <svg> wrapper),
 * so SigilTile owns the viewBox (40) + color field + animation. `ink` is the
 * on-color foreground (#16181C in the brand kit).
 */
export function SigilGlyph({ persona, ink = "#16181C" }: { persona: Persona; ink?: string }) {
  switch (persona) {
    case "hawk":
      // Filled descending diamond + two angular stripes — predatory.
      return (
        <g fill={ink}>
          <path d="M20 8 L30 18 L20 28 L10 18 Z" />
          <rect x="12" y="30" width="16" height="2.2" />
          <rect x="15" y="33.5" width="10" height="2.2" />
        </g>
      );
    case "diplomat":
      // Two interlocking circles — coalition.
      return (
        <g fill="none" stroke={ink} strokeWidth="3">
          <circle cx="15.5" cy="20" r="8.5" />
          <circle cx="24.5" cy="20" r="8.5" />
        </g>
      );
    case "quant":
      // Three measured bars — measurement.
      return (
        <g fill={ink}>
          <rect x="9" y="12" width="22" height="3" rx="1" />
          <rect x="9" y="18.5" width="22" height="3" rx="1" />
          <rect x="9" y="25" width="22" height="3" rx="1" />
        </g>
      );
    case "contrarian":
      // Circle with one half filled — the fade.
      return (
        <>
          <circle cx="20" cy="20" r="12" fill="none" stroke={ink} strokeWidth="2.6" />
          <path d="M20 8 a12 12 0 0 1 0 24 Z" fill={ink} />
        </>
      );
    case "generic":
    default:
      // Diamond outline + center node — user-minted default (child of the mark).
      return (
        <g fill="none" stroke={ink} strokeWidth="2.6">
          <polygon points="20,8 32,20 20,32 8,20" />
          <circle cx="20" cy="20" r="2.6" fill={ink} />
        </g>
      );
  }
}
