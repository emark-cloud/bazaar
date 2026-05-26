import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  MatchScheduled,
  SchedulerStalled,
  SubscriptionEstablished,
} from "../generated/LeagueScheduler/LeagueScheduler";
import { ScheduledMatch, SchedulerStat } from "../generated/schema";

const REACTIVITY_PRECOMPILE = "0x0000000000000000000000000000000000000100";

function getStats(): SchedulerStat {
  let s = SchedulerStat.load("stats");
  if (s == null) {
    s = new SchedulerStat("stats");
    s.matchesScheduled = BigInt.zero();
    s.callbacksReceived = BigInt.zero();
    s.stalls = BigInt.zero();
  }
  return s as SchedulerStat;
}

export function handleMatchScheduled(ev: MatchScheduled): void {
  const id = ev.params.matchId.toString();
  const m = new ScheduledMatch(id);
  m.match = id;
  m.scheduledAt = ev.block.timestamp;
  m.scheduledTx = ev.transaction.hash;
  // If the originating tx was sent by the reactivity precompile, the scheduler was triggered reactively.
  m.triggeredByReactive =
    ev.transaction.from.toHexString().toLowerCase() == REACTIVITY_PRECOMPILE;
  m.seatedAgentIds = ev.params.agentIds;
  m.save();

  const stats = getStats();
  stats.matchesScheduled = stats.matchesScheduled.plus(BigInt.fromI32(1));
  stats.save();
}

export function handleSchedulerStalled(ev: SchedulerStalled): void {
  const stats = getStats();
  stats.stalls = stats.stalls.plus(BigInt.fromI32(1));
  stats.save();
}

export function handleSubscriptionEstablished(ev: SubscriptionEstablished): void {
  // Could store on a settings entity if useful — skipping for now.
}
