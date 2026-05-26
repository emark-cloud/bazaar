import { BigInt } from "@graphprotocol/graph-ts";
import {
  MatchEscrowed,
  MatchSettled,
  MatchRefunded,
  MatchFrozen,
  MatchUnfrozen,
  PayoutSent,
  PayoutFailed,
  SeasonFundDrained,
} from "../generated/Treasury/Treasury";
import { Match, Payout, SeasonFund, MatchParticipation } from "../generated/schema";

function getFund(): SeasonFund {
  let f = SeasonFund.load("fund");
  if (f == null) {
    f = new SeasonFund("fund");
    f.balance = BigInt.zero();
    f.lifetimeIn = BigInt.zero();
    f.lifetimeOut = BigInt.zero();
  }
  return f;
}

export function handleMatchEscrowed(ev: MatchEscrowed): void {
  const m = Match.load(ev.params.matchId.toString());
  if (m == null) return;
  m.pot = ev.params.pot;
  m.save();
  const ids = ev.params.agentIds;
  for (let i = 0; i < ids.length; i++) {
    const pid = ev.params.matchId.toString() + "-" + ids[i].toString();
    const p = MatchParticipation.load(pid);
    if (p != null) {
      p.budget = ev.params.entryStake;
      p.save();
    }
  }
}

export function handleMatchSettled(ev: MatchSettled): void {
  const m = Match.load(ev.params.matchId.toString());
  if (m == null) return;
  m.rake = ev.params.rake;
  m.save();
  const ranked = ev.params.rankedAgentIds;
  const payouts = ev.params.payouts;
  for (let i = 0; i < ranked.length; i++) {
    const pid = ev.params.matchId.toString() + "-" + ranked[i].toString();
    const p = MatchParticipation.load(pid);
    if (p != null) {
      p.payout = payouts[i];
      p.save();
    }
  }
  const f = getFund();
  f.balance = f.balance.plus(ev.params.rake);
  f.lifetimeIn = f.lifetimeIn.plus(ev.params.rake);
  f.save();
}

export function handleMatchRefunded(ev: MatchRefunded): void {
  const m = Match.load(ev.params.matchId.toString());
  if (m == null) return;
  m.phase = 5; // Voided/refunded
  m.save();
}

export function handleMatchFrozen(ev: MatchFrozen): void {
  // Reflected in Audit entity via AuditCouncil events.
}
export function handleMatchUnfrozen(ev: MatchUnfrozen): void {
  // ditto
}

export function handlePayoutSent(ev: PayoutSent): void {
  const id = ev.params.matchId.toString() + "-" + ev.params.agentId.toString();
  const p = new Payout(id);
  p.match = ev.params.matchId.toString();
  p.agent = ev.params.agentId.toString();
  p.owner = ev.params.owner;
  p.amount = ev.params.amount;
  p.failed = false;
  p.blockNumber = ev.block.number;
  p.save();
}

export function handlePayoutFailed(ev: PayoutFailed): void {
  const id = ev.params.matchId.toString() + "-" + ev.params.agentId.toString();
  const p = new Payout(id);
  p.match = ev.params.matchId.toString();
  p.agent = ev.params.agentId.toString();
  p.owner = ev.params.owner;
  p.amount = ev.params.amount;
  p.failed = true;
  p.blockNumber = ev.block.number;
  p.save();
  const f = getFund();
  f.balance = f.balance.plus(ev.params.amount);
  f.save();
}

export function handleSeasonFundDrained(ev: SeasonFundDrained): void {
  const f = getFund();
  f.balance = BigInt.zero();
  f.lifetimeOut = f.lifetimeOut.plus(ev.params.amount);
  f.save();
}
