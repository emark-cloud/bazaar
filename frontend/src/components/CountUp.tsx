import { useCountUpNumber } from "../lib/motion";

/**
 * Counts a number up from 0 → `to` once (easeOutCubic), then holds. Used for the
 * settlement beat — lot values flip and count, agent scores tick up. Collapses to
 * the final value instantly under prefers-reduced-motion (the data stays correct).
 */
export function CountUp({
  to,
  prefix = "",
  suffix = "",
  durationMs = 700,
  className,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  durationMs?: number;
  className?: string;
}) {
  const value = useCountUpNumber(to, durationMs);
  return (
    <span className={className}>
      {prefix}
      {value}
      {suffix}
    </span>
  );
}
