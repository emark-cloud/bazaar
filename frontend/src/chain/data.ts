// Unified data loaders: prefer the subgraph when configured, fall back to direct
// RPC reads otherwise (or on subgraph error). Screens import from here so they
// don't have to know which source answered.
import { fetchAllAgents, fetchAgent } from "./reads";
import { publicClient } from "./client";
import { CONTRACTS } from "./config";
import { AGENT_REGISTRY_ABI } from "./abis";
import {
  subgraphEnabled, sgAgents, sgAgentDetail, sgRecentMatches, sgMatchMoves,
  type AgentDetail, type MatchRow,
} from "./subgraph";
import type { Agent, Hex, MoveEntry } from "./types";

export interface AgentDetailResult extends AgentDetail {
  fromSubgraph: boolean;
}

/** All agents, ELO-ranked. Subgraph = one query; RPC = N reads. */
export async function loadAgents(): Promise<Agent[]> {
  if (subgraphEnabled) {
    try {
      return await sgAgents();
    } catch (e) {
      console.warn("[data] subgraph agents failed, falling back to RPC:", e);
    }
  }
  return fetchAllAgents();
}

/** One agent + history + lifetime earnings. History is subgraph-only. */
export async function loadAgentDetail(id: bigint): Promise<AgentDetailResult | null> {
  if (subgraphEnabled) {
    try {
      const detail = await sgAgentDetail(id);
      if (detail) return { ...detail, fromSubgraph: true };
      // null from subgraph (not yet indexed) → fall through to RPC.
    } catch (e) {
      console.warn("[data] subgraph agentDetail failed, falling back to RPC:", e);
    }
  }
  const agent = await fetchAgent(id);
  if (!agent) return null;
  let owner: Hex = "0x" as Hex;
  try {
    owner = (await publicClient.readContract({
      address: CONTRACTS.agentRegistry, abi: AGENT_REGISTRY_ABI,
      functionName: "ownerOf", args: [id],
    })) as Hex;
  } catch { /* unowned / pruned */ }
  return { agent, owner, lifetimeEarnings: 0n, history: [], fromSubgraph: false };
}

/** Recent matches across the league. Returns [] when no subgraph is configured. */
export async function loadRecentMatches(limit = 8): Promise<MatchRow[]> {
  if (!subgraphEnabled) return [];
  try {
    return await sgRecentMatches(limit);
  } catch (e) {
    console.warn("[data] subgraph recentMatches failed:", e);
    return [];
  }
}

/**
 * The move log for one match. Prefer the subgraph — it has the full transcript
 * for a match of any age, where the RPC log-scan only reaches a short window
 * back from head (so it silently returns nothing for a replay more than a couple
 * minutes old). Fall back to `rpcFallback` when the subgraph is disabled, errors,
 * or has no moves yet (e.g. a match opened seconds ago, not yet indexed).
 */
export async function loadMatchMoves(
  matchId: bigint,
  rpcFallback: () => Promise<MoveEntry[]>,
): Promise<MoveEntry[]> {
  if (subgraphEnabled) {
    try {
      const moves = await sgMatchMoves(matchId);
      if (moves.length > 0) return moves;
      // empty → not indexed yet (brand-new match) → try RPC for the live tail.
    } catch (e) {
      console.warn("[data] subgraph matchMoves failed, falling back to RPC:", e);
    }
  }
  return rpcFallback();
}
