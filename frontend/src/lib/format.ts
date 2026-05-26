import { formatEther } from "viem";

export function formatStt(wei: bigint, digits = 2): string {
  const s = formatEther(wei);
  const [a, b = ""] = s.split(".");
  return `${a}${b ? "." + b.slice(0, digits) : ""} STT`;
}

export function shortAddr(addr?: string): string {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function shortHex(hex?: string, n = 6): string {
  if (!hex) return "—";
  return `${hex.slice(0, 2 + n)}…${hex.slice(-4)}`;
}
