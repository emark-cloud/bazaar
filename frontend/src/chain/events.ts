import { publicClient } from "./client";
import { CONTRACTS } from "./config";
import { ARENA_ABI } from "./abis";
import type { MoveEntry, MoveKind } from "./types";

const MOVE_EVENT_NAMES = [
  "MatchOpened",
  "LotPriced",
  "LotPricingRequested",
  "NegotiationStarted",
  "MoveRequested",
  "MoveMade",
  "MoveDefaulted",
  "MoveRejected",
  "CoalitionFormed",
  "LotSold",
  "LotRevealed",
  "WinnerDeclared",
  "AgentForfeited",
] as const;

export type ArenaEvent = { eventName: (typeof MOVE_EVENT_NAMES)[number]; args: any; blockNumber: bigint; transactionHash: `0x${string}` };

/** Fetch historical Arena events for a given match — used to render the move log on initial load. */
export async function fetchMatchEvents(matchId: bigint, fromBlock?: bigint): Promise<ArenaEvent[]> {
  const head = await publicClient.getBlockNumber();
  // Somnia RPC limits range to 1000 blocks per query — page in 950-block chunks if needed.
  const startBlock = fromBlock ?? head - 10000n; // sane default lookback for a recent match
  const out: ArenaEvent[] = [];
  const CHUNK = 950n;
  for (let from = startBlock; from <= head; from += CHUNK + 1n) {
    const to = from + CHUNK > head ? head : from + CHUNK;
    const logs = await publicClient.getContractEvents({
      address: CONTRACTS.arena,
      abi: ARENA_ABI,
      fromBlock: from,
      toBlock: to,
    });
    for (const log of logs) {
      const args: any = (log as any).args;
      if (args?.matchId !== undefined && args.matchId !== matchId) continue;
      out.push({
        eventName: (log as any).eventName,
        args,
        blockNumber: log.blockNumber!,
        transactionHash: log.transactionHash!,
      });
    }
  }
  out.sort((a, b) => (a.blockNumber < b.blockNumber ? -1 : a.blockNumber > b.blockNumber ? 1 : 0));
  return out;
}

/** Convert raw Arena events into MoveEntry rows for the move log UI. */
export function eventsToMoves(events: ArenaEvent[]): MoveEntry[] {
  const reqIdByTurn = new Map<string, bigint>(); // "round:turnIdx" → requestId
  const moves: MoveEntry[] = [];

  for (const ev of events) {
    if (ev.eventName === "MoveRequested") {
      reqIdByTurn.set(`${ev.args.round}:${ev.args.turnIdx}`, ev.args.requestId as bigint);
    }
    if (ev.eventName === "MoveMade") {
      const raw: string = ev.args.move;
      moves.push({
        matchId: ev.args.matchId,
        round: Number(ev.args.round),
        turnIdx: Number(ev.args.turnIdx),
        agentId: ev.args.agentId,
        kind: classifyMove(raw),
        raw,
        requestId: reqIdByTurn.get(`${ev.args.round}:${ev.args.turnIdx}`),
        blockNumber: ev.blockNumber,
      });
    }
    if (ev.eventName === "MoveDefaulted") {
      moves.push({
        matchId: ev.args.matchId,
        round: Number(ev.args.round),
        turnIdx: Number(ev.args.turnIdx),
        agentId: ev.args.agentId,
        kind: "DEFAULTED",
        raw: ev.args.reason,
        reason: ev.args.reason,
        requestId: reqIdByTurn.get(`${ev.args.round}:${ev.args.turnIdx}`),
        blockNumber: ev.blockNumber,
      });
    }
    if (ev.eventName === "MoveRejected") {
      moves.push({
        matchId: ev.args.matchId,
        round: Number(ev.args.round),
        turnIdx: Number(ev.args.turnIdx),
        agentId: ev.args.agentId,
        kind: "REJECTED",
        raw: ev.args.raw,
        reason: ev.args.reason,
        requestId: reqIdByTurn.get(`${ev.args.round}:${ev.args.turnIdx}`),
        blockNumber: ev.blockNumber,
      });
    }
  }
  return moves;
}

function classifyMove(raw: string): MoveKind {
  const up = raw.trim().toUpperCase();
  if (up.startsWith("OFFER"))     return "OFFER";
  if (up.startsWith("COUNTER"))   return "COUNTER";
  if (up.startsWith("COALITION")) return "COALITION";
  if (up.startsWith("PASS"))      return "PASS";
  return "OFFER";
}

/** Find the most-recently-opened match by walking MatchOpened events backwards. */
export async function findLatestMatchId(): Promise<bigint | null> {
  const head = await publicClient.getBlockNumber();
  for (let to = head; to > 0n; to -= 950n) {
    const from = to > 950n ? to - 950n : 0n;
    const logs = await publicClient.getContractEvents({
      address: CONTRACTS.arena,
      abi: ARENA_ABI,
      eventName: "MatchOpened",
      fromBlock: from,
      toBlock: to,
    });
    if (logs.length > 0) {
      const last = logs[logs.length - 1] as any;
      return last.args.matchId as bigint;
    }
  }
  return null;
}
