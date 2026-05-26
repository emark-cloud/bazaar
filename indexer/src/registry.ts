import { AgentMinted, EloUpdated, AgentJoinableSet } from "../generated/AgentRegistry/AgentRegistry";
import { Agent } from "../generated/schema";

export function handleAgentMinted(ev: AgentMinted): void {
  const a = new Agent(ev.params.agentId.toString());
  a.tokenId = ev.params.agentId;
  a.owner = ev.params.owner;
  a.name = ev.params.name;
  a.promptHash = ev.params.promptHash;
  a.promptURI = ev.params.promptURI;
  a.elo = 1500;
  a.matches = 0;
  a.wins = 0;
  a.joinable = true;
  a.mintedAt = ev.block.timestamp;
  a.save();
}

export function handleEloUpdated(ev: EloUpdated): void {
  const a = Agent.load(ev.params.agentId.toString());
  if (a == null) return;
  a.elo = ev.params.newElo;
  a.matches += 1;
  if (ev.params.win) a.wins += 1;
  a.save();
}

export function handleJoinableSet(ev: AgentJoinableSet): void {
  const a = Agent.load(ev.params.agentId.toString());
  if (a == null) return;
  a.joinable = ev.params.joinable;
  a.save();
}
