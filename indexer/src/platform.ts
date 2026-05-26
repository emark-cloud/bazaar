import { BigInt } from "@graphprotocol/graph-ts";
import {
  RequestCreated,
  RequestFinalized,
} from "../generated/AgentPlatform/AgentPlatform";
import { PlatformRequest } from "../generated/schema";

const VALIDATION_LATENCY_BLOCKS: i32 = 5;

export function handleRequestCreated(ev: RequestCreated): void {
  const id = ev.params.requestId.toString();
  const r = new PlatformRequest(id);
  r.requestId = ev.params.requestId;
  r.agentId = ev.params.agentId;
  r.requester = ev.transaction.from;
  r.payload = ev.params.payload;
  r.createdAtBlock = ev.block.number;
  r.save();
}

export function handleRequestFinalized(ev: RequestFinalized): void {
  const id = ev.params.requestId.toString();
  const r = PlatformRequest.load(id);
  if (r == null) return;
  r.finalizedAtBlock = ev.block.number;
  r.status = ev.params.status;
  // Failure latency heuristic from Phase 0/1: validation-fail completes in <5 blocks,
  // agent-fail takes 30+. The UI uses this to differentiate failure semantics.
  if (ev.params.status == 3 /* Failed */) {
    const delta = ev.block.number.minus(r.createdAtBlock).toI32();
    r.failureKind = delta < VALIDATION_LATENCY_BLOCKS ? "validation" : "agent";
  }
  r.save();
}
