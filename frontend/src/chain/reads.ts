import { publicClient } from "./client";
import { CONTRACTS } from "./config";
import { AGENT_REGISTRY_ABI, ARENA_ABI, AUDIT_COUNCIL_ABI, SCHEDULER_ABI, TREASURY_ABI } from "./abis";
import type { Agent } from "./types";

export async function fetchTotalAgents(): Promise<bigint> {
  return publicClient.readContract({
    address: CONTRACTS.agentRegistry,
    abi: AGENT_REGISTRY_ABI,
    functionName: "totalAgents",
  });
}

export async function fetchAgent(id: bigint): Promise<Agent | null> {
  try {
    const a = await publicClient.readContract({
      address: CONTRACTS.agentRegistry,
      abi: AGENT_REGISTRY_ABI,
      functionName: "getAgent",
      args: [id],
    });
    return {
      id,
      promptHash: a.promptHash,
      promptURI: a.promptURI,
      name: a.name,
      elo: a.elo,
      matches: a.matches,
      wins: a.wins,
      joinable: a.joinable,
    };
  } catch {
    return null;
  }
}

export async function fetchAllAgents(): Promise<Agent[]> {
  const total = await fetchTotalAgents();
  const ids: bigint[] = [];
  for (let i = 1n; i <= total; i++) ids.push(i);
  const rows = await Promise.all(ids.map((id) => fetchAgent(id)));
  return rows.filter((a): a is Agent => a !== null);
}

export async function fetchArenaNextMatchId(): Promise<bigint> {
  return publicClient.readContract({
    address: CONTRACTS.arena, abi: ARENA_ABI, functionName: "nextMatchId",
  });
}

export async function fetchMatch(matchId: bigint) {
  const m = await publicClient.readContract({
    address: CONTRACTS.arena, abi: ARENA_ABI, functionName: "getMatch", args: [matchId],
  });
  return {
    matchId,
    kind: Number(m[0]),
    phase: Number(m[1]),
    agentIds: m[2] as readonly bigint[],
    budgets: m[3] as readonly bigint[],
    rounds: Number(m[4]),
    currentRound: Number(m[5]),
    currentTurnIdx: Number(m[6]),
    numLots: Number(m[7]),
  };
}

export async function fetchLot(matchId: bigint, lotIndex: number) {
  return publicClient.readContract({
    address: CONTRACTS.arena, abi: ARENA_ABI, functionName: "getLot",
    args: [matchId, lotIndex],
  });
}

export async function fetchAllLots(matchId: bigint, numLots: number) {
  if (numLots === 0) return [];
  const out = [];
  for (let i = 0; i < numLots; i++) {
    out.push(await fetchLot(matchId, i));
  }
  return out;
}

export async function fetchTreasurySeasonFund(): Promise<bigint> {
  return publicClient.readContract({
    address: CONTRACTS.treasury, abi: TREASURY_ABI, functionName: "seasonFund",
  });
}

export async function fetchSchedulerStats(): Promise<{ matchesScheduled: bigint; callbacksReceived: bigint; subscriptionId: bigint }> {
  const [ms, cb, sub] = await Promise.all([
    publicClient.readContract({ address: CONTRACTS.scheduler, abi: SCHEDULER_ABI, functionName: "matchesScheduled" }),
    publicClient.readContract({ address: CONTRACTS.scheduler, abi: SCHEDULER_ABI, functionName: "callbacksReceived" }),
    publicClient.readContract({ address: CONTRACTS.scheduler, abi: SCHEDULER_ABI, functionName: "subscriptionId" }),
  ]);
  return { matchesScheduled: ms, callbacksReceived: cb, subscriptionId: sub };
}

export async function fetchAuditState(matchId: bigint) {
  return publicClient.readContract({
    address: CONTRACTS.auditCouncil, abi: AUDIT_COUNCIL_ABI, functionName: "getAudit", args: [matchId],
  });
}
