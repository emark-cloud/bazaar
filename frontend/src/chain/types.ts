export type Address = `0x${string}`;
export type Hex     = `0x${string}`;

export const MATCH_PHASE = ["None", "Pricing", "Negotiating", "Settling", "Finalized", "Voided"] as const;
export type MatchPhase = (typeof MATCH_PHASE)[number];

export const MATCH_KIND = ["Exhibition", "RealStakes"] as const;
export type MatchKind = (typeof MATCH_KIND)[number];

export const AUDIT_STATUS = ["None", "AwaitingVRF", "AwaitingResults", "Finalized"] as const;
export type AuditStatus = (typeof AUDIT_STATUS)[number];

export interface Agent {
  id: bigint;
  promptHash: Hex;
  promptURI: string;
  name: string;
  elo: number;
  matches: number;
  wins: number;
  joinable: boolean;
}

export type MoveKind = "OFFER" | "COUNTER" | "COALITION" | "PASS" | "REJECTED" | "DEFAULTED";

export interface MoveEntry {
  matchId: bigint;
  round: number;
  turnIdx: number;
  agentId: bigint;
  kind: MoveKind;
  raw: string;                 // the literal LLM output, or rejected raw payload
  reason?: string;             // for DEFAULTED/REJECTED
  requestId?: bigint;          // for trace layer
  blockNumber?: bigint;
}
