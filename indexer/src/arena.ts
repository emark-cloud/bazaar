import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  MatchOpened,
  LotPriced,
  LotPricingRequested,
  NegotiationStarted,
  MoveRequested,
  MoveMade,
  MoveDefaulted,
  MoveRejected,
  CoalitionFormed,
  LotSold,
  LotRevealed,
  WinnerDeclared,
  AgentForfeited,
} from "../generated/Arena/Arena";
import {
  Match,
  Lot,
  Move,
  MatchParticipation,
  Agent,
  PlatformRequest,
  MoveRequestLink,
} from "../generated/schema";

function moveId(matchId: BigInt, round: i32, turnIdx: i32): string {
  return matchId.toString() + "-" + round.toString() + "-" + turnIdx.toString();
}

/**
 * Attach the platform requestId (captured on MoveRequested) to a Move row. The
 * MoveMade/Defaulted/Rejected events don't carry the requestId, so we look it up
 * by the move's "<matchId>-<round>-<turnIdx>" key. The requestId is the receipt
 * key the UI uses to show the agent's reasoning trace.
 */
function attachRequest(m: Move, matchId: BigInt, round: i32, turnIdx: i32): void {
  const link = MoveRequestLink.load(moveId(matchId, round, turnIdx));
  if (link == null) return;
  m.requestId = link.requestId;
  m.request = link.requestId.toString();
}

function lotId(matchId: BigInt, lotIndex: i32): string {
  return matchId.toString() + "-" + lotIndex.toString();
}

function participationId(matchId: BigInt, agentId: BigInt): string {
  return matchId.toString() + "-" + agentId.toString();
}

function classifyMove(raw: string): string {
  const up = raw.toUpperCase();
  if (up.startsWith("OFFER")) return "OFFER";
  if (up.startsWith("COUNTER")) return "COUNTER";
  if (up.startsWith("COALITION")) return "COALITION";
  if (up.startsWith("PASS")) return "PASS";
  return "OFFER";
}

export function handleMatchOpened(ev: MatchOpened): void {
  const m = new Match(ev.params.matchId.toString());
  m.matchId = ev.params.matchId;
  m.kind = ev.params.kind;
  m.phase = 1; // Pricing
  m.rounds = ev.params.rounds;
  m.numLots = ev.params.numLots;
  m.openedAt = ev.block.timestamp;
  m.openedAtBlock = ev.block.number;
  m.openedTx = ev.transaction.hash;
  m.save();

  const ids = ev.params.agentIds;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const p = new MatchParticipation(participationId(ev.params.matchId, id));
    p.match = m.id;
    p.agent = id.toString();
    p.budget = BigInt.zero();
    p.forfeited = false;
    p.save();
  }
}

export function handleLotPriced(ev: LotPriced): void {
  const id = lotId(ev.params.matchId, ev.params.lotIndex);
  let lot = Lot.load(id);
  if (lot == null) {
    lot = new Lot(id);
    lot.match = ev.params.matchId.toString();
    lot.lotIndex = ev.params.lotIndex;
    lot.category = "";
    lot.feedUrl = "";
    lot.revealed = false;
  }
  lot.valueCommitment = ev.params.valueCommitment;
  lot.save();
}

export function handleLotPricingRequested(ev: LotPricingRequested): void {
  // No-op — the platform handler creates the PlatformRequest entity. Kept for completeness.
}

export function handleNegotiationStarted(ev: NegotiationStarted): void {
  const m = Match.load(ev.params.matchId.toString());
  if (m == null) return;
  m.phase = 2; // Negotiating
  m.save();
}

export function handleMoveRequested(ev: MoveRequested): void {
  // The Move row is created later (on MoveMade/Defaulted/Rejected), and those
  // events don't re-emit the requestId — so stash it here, keyed by the move's
  // turn, for the resolving handler to attach. MoveRequested fires exactly once
  // per turn, so the link is immutable.
  const link = new MoveRequestLink(moveId(ev.params.matchId, ev.params.round, ev.params.turnIdx));
  link.requestId = ev.params.requestId;
  link.save();
}

export function handleMoveMade(ev: MoveMade): void {
  const m = new Move(moveId(ev.params.matchId, ev.params.round, ev.params.turnIdx));
  m.match = ev.params.matchId.toString();
  m.agent = ev.params.agentId.toString();
  m.round = ev.params.round;
  m.turnIdx = ev.params.turnIdx;
  m.raw = ev.params.move;
  m.kind = classifyMove(ev.params.move);
  m.blockNumber = ev.block.number;
  m.blockTimestamp = ev.block.timestamp;
  m.tx = ev.transaction.hash;
  attachRequest(m, ev.params.matchId, ev.params.round, ev.params.turnIdx);
  m.save();
}

export function handleMoveDefaulted(ev: MoveDefaulted): void {
  const m = new Move(moveId(ev.params.matchId, ev.params.round, ev.params.turnIdx));
  m.match = ev.params.matchId.toString();
  m.agent = ev.params.agentId.toString();
  m.round = ev.params.round;
  m.turnIdx = ev.params.turnIdx;
  m.raw = ev.params.reason;
  m.reason = ev.params.reason;
  m.kind = "DEFAULTED";
  m.blockNumber = ev.block.number;
  m.blockTimestamp = ev.block.timestamp;
  m.tx = ev.transaction.hash;
  attachRequest(m, ev.params.matchId, ev.params.round, ev.params.turnIdx);
  m.save();
}

export function handleMoveRejected(ev: MoveRejected): void {
  const m = new Move(moveId(ev.params.matchId, ev.params.round, ev.params.turnIdx));
  m.match = ev.params.matchId.toString();
  m.agent = ev.params.agentId.toString();
  m.round = ev.params.round;
  m.turnIdx = ev.params.turnIdx;
  m.raw = ev.params.raw;
  m.reason = ev.params.reason;
  m.kind = "REJECTED";
  m.blockNumber = ev.block.number;
  m.blockTimestamp = ev.block.timestamp;
  m.tx = ev.transaction.hash;
  attachRequest(m, ev.params.matchId, ev.params.round, ev.params.turnIdx);
  m.save();
}

export function handleCoalitionFormed(ev: CoalitionFormed): void {
  // CoalitionFormed is also reflected in the Move's kind=COALITION; nothing else to store separately.
}

export function handleLotSold(ev: LotSold): void {
  const id = lotId(ev.params.matchId, ev.params.lotIndex);
  let lot = Lot.load(id);
  if (lot == null) {
    lot = new Lot(id);
    lot.match = ev.params.matchId.toString();
    lot.lotIndex = ev.params.lotIndex;
    lot.category = "";
    lot.feedUrl = "";
    lot.revealed = false;
  }
  lot.ownerAgentId = ev.params.buyerAgentId;
  lot.paidPrice = ev.params.price;
  lot.save();
}

export function handleLotRevealed(ev: LotRevealed): void {
  const id = lotId(ev.params.matchId, ev.params.lotIndex);
  let lot = Lot.load(id);
  if (lot == null) {
    lot = new Lot(id);
    lot.match = ev.params.matchId.toString();
    lot.lotIndex = ev.params.lotIndex;
    lot.category = "";
    lot.feedUrl = "";
  }
  lot.revealedValue = ev.params.trueValue;
  lot.revealed = true;
  lot.save();
}

export function handleWinnerDeclared(ev: WinnerDeclared): void {
  const m = Match.load(ev.params.matchId.toString());
  if (m == null) return;
  m.phase = 4; // Finalized
  m.winnerAgentId = ev.params.winnerAgentId;
  m.winnerScore = ev.params.winnerScore;
  m.finalizedAt = ev.block.timestamp;
  m.save();
}

export function handleAgentForfeited(ev: AgentForfeited): void {
  const id = participationId(ev.params.matchId, ev.params.agentId);
  const p = MatchParticipation.load(id);
  if (p == null) return;
  p.forfeited = true;
  p.save();
}
