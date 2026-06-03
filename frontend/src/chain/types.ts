export type Address = `0x${string}`;
export type Hex     = `0x${string}`;

export const MATCH_PHASE = ["None", "Pricing", "Negotiating", "Settling", "Finalized", "Voided"] as const;
export type MatchPhase = (typeof MATCH_PHASE)[number];

/** Plain-language phase names for the UI (the raw enum is the on-chain wire name). */
export const MATCH_PHASE_LABEL: Record<MatchPhase, string> = {
  None: "Not started",
  Pricing: "Setting values",
  Negotiating: "Bidding",
  Settling: "Paying out",
  Finalized: "Finished",
  Voided: "Cancelled",
};

export const MATCH_KIND = ["Exhibition", "RealStakes"] as const;
export type MatchKind = (typeof MATCH_KIND)[number];

export const AUDIT_STATUS = ["None", "AwaitingVRF", "AwaitingResults", "Finalized"] as const;
export type AuditStatus = (typeof AUDIT_STATUS)[number];

/** Plain-language audit states — "AwaitingVRF" et al. mean nothing to a visitor. */
export const AUDIT_STATUS_LABEL: Record<AuditStatus, string> = {
  None: "—",
  AwaitingVRF: "Picking reviewers",
  AwaitingResults: "Reviewing",
  Finalized: "Reviewed",
};

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
