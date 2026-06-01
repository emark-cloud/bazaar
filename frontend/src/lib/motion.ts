import { useEffect, useRef, useState } from "react";

/**
 * Tracks the user's `prefers-reduced-motion` setting, live.
 * design.md §4: "Respect prefers-reduced-motion by collapsing to instant state
 * changes (the data stays correct; only the animation drops)."
 */
export function usePrefersReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/**
 * Counts a bigint up from 0 → target once `active` becomes true.
 * Used for the settlement lot-reveal ("real value counts up"). Collapses to the
 * final value instantly under prefers-reduced-motion. Kept in bigint space so
 * large feed values (e.g. BTC cents) don't lose precision.
 */
export function useCountUp(target: bigint, active: boolean, durationMs = 650): bigint {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState<bigint>(active ? target : 0n);
  const raf = useRef<number>();
  const startedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!active) {
      setValue(0n);
      startedFor.current = null;
      return;
    }
    if (reduced) {
      setValue(target);
      return;
    }
    // Only (re)start the animation when the target actually changes, so the
    // 6 s LiveMatch poll re-renders don't restart the count.
    const key = target.toString();
    if (startedFor.current === key) return;
    startedFor.current = key;

    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const scaled = (target * BigInt(Math.round(eased * 1000))) / 1000n;
      setValue(scaled);
      if (t < 1) raf.current = requestAnimationFrame(step);
      else setValue(target);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, active, reduced, durationMs]);

  return value;
}

/**
 * Number variant of {@link useCountUp} for already-small integers (scores, P&L).
 * Counts 0 → target on mount / when target changes (easeOutCubic). Negative
 * targets count down through zero naturally. Instant under reduced motion.
 */
export function useCountUpNumber(target: number, durationMs = 700): number {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState<number>(reduced ? target : 0);
  const raf = useRef<number>();

  useEffect(() => {
    if (reduced) { setValue(target); return; }
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf.current = requestAnimationFrame(step);
      else setValue(target);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, reduced, durationMs]);

  return value;
}
