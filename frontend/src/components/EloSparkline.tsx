/**
 * A tiny inline ELO sparkline — pure SVG polyline + faint fill + end dot, drawn
 * in the agent's persona color. No charting library. `track` is the ELO history
 * oldest→newest (e.g. [seasonStart, …, current]).
 */
export function EloSparkline({ track, color }: { track: number[]; color: string }) {
  const w = 280, h = 64, pad = 6;
  const pts = track.length >= 2 ? track : [track[0] ?? 1500, track[0] ?? 1500];
  const min = Math.min(...pts), max = Math.max(...pts);
  const span = Math.max(1, max - min);
  const coords = pts.map((v, i) => {
    const x = pad + (i / Math.max(1, pts.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = coords.map((p) => p.join(",")).join(" ");
  const last = coords[coords.length - 1];

  return (
    <svg className="w-full h-16 block" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline
        points={`${pad},${h - pad} ${line} ${w - pad},${h - pad}`}
        fill={color}
        fillOpacity="0.08"
        stroke="none"
      />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={color} />
    </svg>
  );
}
