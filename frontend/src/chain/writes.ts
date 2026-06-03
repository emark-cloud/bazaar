import { useCallback, useState } from "react";
import type { WalletClient } from "viem";
import { publicClient } from "./client";
import { CONTRACTS } from "./config";
import { ARENA_ABI, SCHEDULER_ABI } from "./abis";

// --- lot templates -----------------------------------------------------------
// The default two feeds the league/CLI use. `valueDivisor` is bigint for the ABI.
export interface LotTemplate {
  category: string; feedUrl: string; feedSelector: string;
  feedDecimals: number; valueDivisor: bigint; valueHint: string;
}
export const DEFAULT_LOTS: LotTemplate[] = [
  { category: "ETH-USD", feedUrl: "https://api.coinbase.com/v2/prices/ETH-USD/spot",
    feedSelector: "data.amount", feedDecimals: 0, valueDivisor: 1n, valueHint: "typically 1500-4000" },
  { category: "SOL-USD", feedUrl: "https://api.coinbase.com/v2/prices/SOL-USD/spot",
    feedSelector: "data.amount", feedDecimals: 0, valueDivisor: 1n, valueHint: "typically 50-200" },
];

// --- operating-cost math (mirrors Arena._worstCaseOpCost / open-match.sh) -----
const FLOOR = 30_000_000_000_000_000n;       // platform.getRequestDeposit() = 0.03 STT
const PRICE_LLM = 70_000_000_000_000_000n;   // 0.07
const PRICE_JSON = 30_000_000_000_000_000n;  // 0.03
const SUBC = 3n;

// Arena.MAX_ROUNDS — the hardcoded safety cap. Matches usually end earlier on a stall, but the
// opener must fund the worst case up-front (unused deposits are rebated on the early end).
export const MAX_ROUNDS = 10;

/** Worst-case STT the Arena must hold to finish a match (every call pays full deposit). */
export function worstCaseOperating(seats: number, lots: number): bigint {
  const depMove = FLOOR + PRICE_LLM * SUBC;
  const depPrice = FLOOR + PRICE_JSON * SUBC;
  return BigInt(seats * MAX_ROUNDS) * depMove + BigInt(lots) * depPrice;
}
/** msg.value to send: operating headroom (+20%), plus the pot for real-stakes. */
export function operatingValue(seats: number, lots: number): bigint {
  return (worstCaseOperating(seats, lots) * 12n) / 10n;
}

const STARTING_BUDGET = 25_000_000_000_000_000_000n; // 25 STT in-game budget (exhibition)

// --- low-level write with Somnia gas headroom --------------------------------
// Somnia meters gas far above a standard EVM and injected wallets under-estimate
// (see Mint.tsx). Estimate against our RPC + 30% headroom; explicit limit on the tx.
async function writeWithGas(
  client: WalletClient, account: `0x${string}`,
  params: { address: `0x${string}`; abi: readonly unknown[]; functionName: string; args: readonly unknown[]; value?: bigint },
  fallbackGas: bigint,
): Promise<`0x${string}`> {
  let gas: bigint;
  try {
    const est = await publicClient.estimateContractGas({
      address: params.address, abi: params.abi as never, functionName: params.functionName as never,
      args: params.args as never, account, value: params.value,
    });
    gas = (est * 13n) / 10n;
  } catch {
    gas = fallbackGas;
  }
  return client.writeContract({
    address: params.address, abi: params.abi as never, functionName: params.functionName as never,
    args: params.args as never, account, value: params.value, chain: undefined, gas,
  });
}

export async function openExhibitionTx(
  client: WalletClient, account: `0x${string}`,
  opts: { agentIds: bigint[]; lots?: LotTemplate[] },
): Promise<`0x${string}`> {
  const lots = opts.lots ?? DEFAULT_LOTS;
  const value = operatingValue(opts.agentIds.length, lots.length);
  return writeWithGas(client, account, {
    address: CONTRACTS.arena, abi: ARENA_ABI, functionName: "openExhibition",
    args: [opts.agentIds, STARTING_BUDGET, lots], value,
  }, 15_000_000n);
}

export async function openRealStakesTx(
  client: WalletClient, account: `0x${string}`,
  opts: { agentIds: bigint[]; entryStakeWei: bigint; lots?: LotTemplate[] },
): Promise<`0x${string}`> {
  const lots = opts.lots ?? DEFAULT_LOTS;
  const pot = opts.entryStakeWei * BigInt(opts.agentIds.length);
  const value = pot + operatingValue(opts.agentIds.length, lots.length);
  return writeWithGas(client, account, {
    address: CONTRACTS.arena, abi: ARENA_ABI, functionName: "openRealStakes",
    args: [opts.agentIds, opts.entryStakeWei, lots], value,
  }, 15_000_000n);
}

export async function pokeOpenNextTx(
  client: WalletClient, account: `0x${string}`,
): Promise<`0x${string}`> {
  return writeWithGas(client, account, {
    address: CONTRACTS.scheduler, abi: SCHEDULER_ABI, functionName: "pokeOpenNext", args: [],
  }, 15_000_000n);
}

/** The real-stakes value (pot + operating) a given config would send — for cost previews. */
export function realStakesValue(seats: number, entryStakeWei: bigint): bigint {
  return entryStakeWei * BigInt(seats) + operatingValue(seats, DEFAULT_LOTS.length);
}

// --- scheduler config + balance (for the Advance-League affordability hint) ----
export interface SchedulerConfig {
  entryStake: bigint; seatCount: number;
  operatingPerMatch: bigint; minBalanceThreshold: bigint; balance: bigint;
}
export async function fetchSchedulerConfig(): Promise<SchedulerConfig> {
  const [entryStake, seatCount, operatingPerMatch, minBalanceThreshold, balance] = await Promise.all([
    publicClient.readContract({ address: CONTRACTS.scheduler, abi: SCHEDULER_ABI, functionName: "entryStake" }),
    publicClient.readContract({ address: CONTRACTS.scheduler, abi: SCHEDULER_ABI, functionName: "seatCount" }),
    publicClient.readContract({ address: CONTRACTS.scheduler, abi: SCHEDULER_ABI, functionName: "operatingPerMatch" }),
    publicClient.readContract({ address: CONTRACTS.scheduler, abi: SCHEDULER_ABI, functionName: "minBalanceThreshold" }),
    publicClient.getBalance({ address: CONTRACTS.scheduler }),
  ]);
  return {
    entryStake, seatCount: Number(seatCount),
    operatingPerMatch, minBalanceThreshold, balance,
  };
}
/** The scheduler's own open-gate: balance >= max(minBalanceThreshold, cost + 32 STT). */
export function schedulerCanOpen(c: SchedulerConfig): { ok: boolean; required: bigint } {
  const cost = c.entryStake * BigInt(c.seatCount) + c.operatingPerMatch;
  const required = cost + 32_000_000_000_000_000_000n > c.minBalanceThreshold
    ? cost + 32_000_000_000_000_000_000n : c.minBalanceThreshold;
  return { ok: c.balance >= required, required };
}

// --- shared tx lifecycle hook -------------------------------------------------
export type TxStatus =
  | { kind: "idle" }
  | { kind: "signing" }
  | { kind: "pending"; hash: `0x${string}` }
  | { kind: "done"; hash: `0x${string}` }
  | { kind: "error"; message: string };

export function useTxAction() {
  const [status, setStatus] = useState<TxStatus>({ kind: "idle" });
  const run = useCallback(async (send: () => Promise<`0x${string}`>) => {
    setStatus({ kind: "signing" });
    try {
      const hash = await send();
      setStatus({ kind: "pending", hash });
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus({ kind: "done", hash });
    } catch (err: unknown) {
      const message = (err as { shortMessage?: string; message?: string })?.shortMessage
        ?? (err as { message?: string })?.message ?? "Transaction failed.";
      setStatus({ kind: "error", message });
    }
  }, []);
  return { status, run, reset: () => setStatus({ kind: "idle" }) };
}
