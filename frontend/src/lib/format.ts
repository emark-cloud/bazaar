import { formatEther } from "viem";

export function formatStt(wei: bigint, digits = 2): string {
  const s = formatEther(wei);
  const [a, b = ""] = s.split(".");
  return `${a}${b ? "." + b.slice(0, digits) : ""} STT`;
}

/**
 * Scale a signed score/P&L to a display number. Scores are `worth − paidPrice` in whatever unit the
 * match's budget used: an STT-int (small integer) for exhibition, or wei for real-stakes. Small
 * magnitudes pass through as-is; wei-scale magnitudes (|v| ≥ 1e9) collapse to their STT float — so a
 * +305 exhibition score and a wei-scale score both render as a sane "± N STT" instead of a raw 1e19.
 * Sign-aware (formatBudget is not — its <1e9 branch would print negative wei raw).
 */
export function sttScale(v: bigint): number {
  const neg = v < 0n;
  const mag = neg ? -v : v;
  if (mag < 1_000_000_000n) return Number(v);
  const stt = Number(formatEther(mag));
  return neg ? -stt : stt;
}

export function shortAddr(addr?: string): string {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function shortHex(hex?: string, n = 6): string {
  if (!hex) return "—";
  return `${hex.slice(0, 2 + n)}…${hex.slice(-4)}`;
}

/**
 * A match budget is unit-ambiguous on-chain (Arena.sol): real-stakes matches
 * seed it in wei (from escrowed STT), while exhibition matches may seed a small
 * integer. Render wei-scale values as STT (≤2 decimals, trailing zeros trimmed)
 * and small integers as-is. Returns the numeric string only — no " STT" suffix,
 * so callers control unit styling. 1e9 cleanly separates the two: no realistic
 * integer budget reaches a billion, and any wei STT budget is ≥ 1e9 wei.
 */
export function formatBudget(budget?: bigint): string {
  if (budget === undefined) return "—";
  if (budget < 1_000_000_000n) return budget.toString();
  const [whole, frac = ""] = formatEther(budget).split(".");
  const dec = frac.slice(0, 2).replace(/0+$/, "");
  return dec ? `${whole}.${dec}` : whole;
}
