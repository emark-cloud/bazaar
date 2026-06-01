/**
 * The Bazaar brand mark — "Convergence" (brand-kit Concept A): four agent
 * strokes converging on a central deal node. The parent of the four persona
 * sigils. Recolor only in amber / ink / white (brand-kit usage rule).
 */
export function BazaarMark({
  size = 22,
  color = "#F5A623",
  className,
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <g stroke={color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M14 14 L42 42 M30 14 L42 14 L42 26" />
        <path d="M106 14 L78 42 M90 14 L78 14 L78 26" />
        <path d="M14 106 L42 78 M30 106 L42 106 L42 94" />
        <path d="M106 106 L78 78 M90 106 L78 106 L78 94" />
      </g>
      <rect x="50" y="50" width="20" height="20" rx="5" fill={color} />
    </svg>
  );
}
