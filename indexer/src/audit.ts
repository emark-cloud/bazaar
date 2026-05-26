import { BigInt } from "@graphprotocol/graph-ts";
import {
  AuditStarted,
  AuditorsSelected,
  VerdictReceived,
  ParseCheckReceived,
  AuditFinalized,
  AuditTimedOut,
} from "../generated/AuditCouncil/AuditCouncil";
import { Audit } from "../generated/schema";

function loadOrInit(matchId: BigInt): Audit {
  let a = Audit.load(matchId.toString());
  if (a == null) {
    a = new Audit(matchId.toString());
    a.match = matchId.toString();
    a.status = 0;
    a.startedAt = BigInt.zero();
    a.startedAtBlock = BigInt.zero();
    a.appealUntil = BigInt.zero();
    a.auditorIds = [];
    a.verdictsSuspect = 0;
    a.verdictsClean = 0;
    a.parseChecksSuspect = 0;
    a.parseChecksTotal = 0;
    a.finalized = false;
  }
  return a as Audit;
}

export function handleAuditStarted(ev: AuditStarted): void {
  const a = loadOrInit(ev.params.matchId);
  a.status = 1; // AwaitingVRF
  a.vrfRequestId = ev.params.vrfRequestId;
  a.startedAt = ev.block.timestamp;
  a.startedAtBlock = ev.block.number;
  a.save();
}

export function handleAuditorsSelected(ev: AuditorsSelected): void {
  const a = loadOrInit(ev.params.matchId);
  a.status = 2; // AwaitingResults
  a.auditorIds = ev.params.auditorIds;
  a.save();
}

export function handleVerdictReceived(ev: VerdictReceived): void {
  const a = loadOrInit(ev.params.matchId);
  if (ev.params.verdict == "suspect") a.verdictsSuspect += 1;
  else a.verdictsClean += 1;
  a.save();
}

export function handleParseCheckReceived(ev: ParseCheckReceived): void {
  const a = loadOrInit(ev.params.matchId);
  a.parseChecksTotal += 1;
  if (ev.params.suspect) a.parseChecksSuspect += 1;
  a.save();
}

export function handleAuditFinalized(ev: AuditFinalized): void {
  const a = loadOrInit(ev.params.matchId);
  a.status = 3; // Finalized
  a.finalized = true;
  a.suspect = ev.params.suspect;
  a.save();
}

export function handleAuditTimedOut(ev: AuditTimedOut): void {
  // Status -> 3 happens on AuditFinalized which fires from the same _finalize internal call.
}
