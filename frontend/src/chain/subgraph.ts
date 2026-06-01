// GraphQL data path against the Bazaar subgraph (Ormi / local graph-node).
// Opt-in: set VITE_SUBGRAPH_URL. When unset or on error, callers fall back to
// direct-RPC reads (see ./reads.ts), so the UI works with or without an indexer.
import type { Agent, Hex } from "./types";

export const SUBGRAPH_URL: string | undefined = import.meta.env.VITE_SUBGRAPH_URL?.trim() || undefined;
export const subgraphEnabled = !!SUBGRAPH_URL;

class SubgraphError extends Error {}

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  if (!SUBGRAPH_URL) throw new SubgraphError("subgraph disabled");
  const res = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new SubgraphError(`subgraph HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new SubgraphError(json.errors[0]?.message ?? "graphql error");
  return json.data as T;
}

// --- shapes returned from the subgraph (string scalars decoded to bigint/number) ---

export interface MatchRow {
  matchId: bigint;
  kind: number;
  phase: number;
  numLots: number;
  openedAt: bigint;
  finalizedAt?: bigint;
  winnerAgentId?: bigint;
  pot?: bigint;
}

export interface AgentHistoryRow {
  matchId: bigint;
  kind: number;
  finalScore?: bigint;
  forfeited: boolean;
  payout?: bigint;
  won: boolean;
}

export interface AgentDetail {
  agent: Agent;
  owner: Hex;
  lifetimeEarnings: bigint;
  history: AgentHistoryRow[];
}

// --- mappers ---

const toBig = (v: string | null | undefined): bigint | undefined =>
  v === null || v === undefined ? undefined : BigInt(v);

function mapAgent(a: AgentNode): Agent {
  return {
    id: BigInt(a.tokenId),
    promptHash: a.promptHash as Hex,
    promptURI: a.promptURI,
    name: a.name,
    elo: a.elo,
    matches: a.matches,
    wins: a.wins,
    joinable: a.joinable,
  };
}

interface AgentNode {
  tokenId: string; owner: string; name: string; promptHash: string; promptURI: string;
  elo: number; matches: number; wins: number; joinable: boolean;
}

// --- queries ---

/** All agents, ranked by ELO — one round-trip instead of N contract reads. */
export async function sgAgents(): Promise<Agent[]> {
  const data = await gql<{ agents: AgentNode[] }>(`
    query Agents {
      agents(first: 200, orderBy: elo, orderDirection: desc) {
        tokenId owner name promptHash promptURI elo matches wins joinable
      }
    }`);
  return data.agents.map(mapAgent);
}

/** One agent with its full match history + lifetime earnings — pure subgraph value. */
export async function sgAgentDetail(id: bigint): Promise<AgentDetail | null> {
  const data = await gql<{ agent: (AgentNode & {
    participations: { match: { matchId: string; kind: number; winnerAgentId: string | null; openedAt: string }; finalScore: string | null; forfeited: boolean; payout: string | null }[];
    payoutsReceived: { amount: string; failed: boolean }[];
  }) | null }>(`
    query AgentDetail($id: ID!) {
      agent(id: $id) {
        tokenId owner name promptHash promptURI elo matches wins joinable
        participations(first: 100) {
          finalScore forfeited payout
          match { matchId kind winnerAgentId openedAt }
        }
        payoutsReceived(first: 200, where: { failed: false }) { amount failed }
      }
    }`, { id: id.toString() });

  if (!data.agent) return null;
  const a = data.agent;
  const lifetimeEarnings = a.payoutsReceived.reduce((sum, p) => sum + BigInt(p.amount), 0n);
  const history: AgentHistoryRow[] = a.participations
    // graph-node can't order a derived relation by a nested parent field, so sort
    // newest-first here by the match's openedAt.
    .slice()
    .sort((x, y) => (BigInt(y.match.openedAt) > BigInt(x.match.openedAt) ? 1 : -1))
    .map((p) => ({
      matchId: BigInt(p.match.matchId),
      kind: p.match.kind,
      finalScore: toBig(p.finalScore),
      forfeited: p.forfeited,
      payout: toBig(p.payout),
      won: p.match.winnerAgentId !== null && BigInt(p.match.winnerAgentId) === id,
    }));
  return { agent: mapAgent(a), owner: a.owner as Hex, lifetimeEarnings, history };
}

/** Most recent matches across the league — for the Hub feed. */
export async function sgRecentMatches(limit = 8): Promise<MatchRow[]> {
  const data = await gql<{ matches: {
    matchId: string; kind: number; phase: number; numLots: number;
    openedAt: string; finalizedAt: string | null; winnerAgentId: string | null; pot: string | null;
  }[] }>(`
    query RecentMatches($limit: Int!) {
      matches(first: $limit, orderBy: openedAt, orderDirection: desc) {
        matchId kind phase numLots openedAt finalizedAt winnerAgentId pot
      }
    }`, { limit });
  return data.matches.map((m) => ({
    matchId: BigInt(m.matchId),
    kind: m.kind,
    phase: m.phase,
    numLots: m.numLots,
    openedAt: BigInt(m.openedAt),
    finalizedAt: toBig(m.finalizedAt),
    winnerAgentId: toBig(m.winnerAgentId),
    pot: toBig(m.pot),
  }));
}
