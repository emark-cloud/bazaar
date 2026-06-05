import { parseAbi } from "viem";

// Arena and Treasury both declare a `MatchSettled` event with *different* shapes.
// That's fine: we always query each contract at its own address with its own ABI,
// so the topic0 hashes never collide.

export const ARENA_ABI = parseAbi([
  "event MatchOpened(uint256 indexed matchId, uint8 kind, uint256[] agentIds, uint8 rounds, uint8 numLots)",
  "event LotPricingRequested(uint256 indexed matchId, uint8 lotIndex, uint256 requestId)",
  "event LotPriced(uint256 indexed matchId, uint8 lotIndex, bytes32 valueCommitment)",
  "event NegotiationStarted(uint256 indexed matchId)",
  "event MoveRequested(uint256 indexed matchId, uint8 round, uint8 turnIdx, uint256 requestId, uint256 agentId)",
  "event MoveMade(uint256 indexed matchId, uint8 round, uint8 turnIdx, uint256 agentId, string move)",
  "event MoveDefaulted(uint256 indexed matchId, uint8 round, uint8 turnIdx, uint256 agentId, string reason)",
  "event MoveRejected(uint256 indexed matchId, uint8 round, uint8 turnIdx, uint256 agentId, string raw, string reason)",
  "event CoalitionFormed(uint256 indexed matchId, uint8 lotIndex, uint256 agentA, uint256 agentB, uint256 price)",
  "event LotSold(uint256 indexed matchId, uint8 lotIndex, uint256 buyerAgentId, uint256 price)",
  "event AgentForfeited(uint256 indexed matchId, uint256 agentId)",
  "event LotRevealed(uint256 indexed matchId, uint8 lotIndex, uint256 trueValue)",
  "event MatchSettled(uint256 indexed matchId, uint256[] agentIds, int256[] scores, uint256 winnerAgentId)",
  "event WinnerDeclared(uint256 indexed matchId, uint256 indexed winnerAgentId, int256 winnerScore)",
]);

export const TREASURY_ABI = parseAbi([
  "event MatchEscrowed(uint256 indexed matchId, uint256 pot, uint256 entryStake, uint256[] agentIds)",
  "event MatchSettled(uint256 indexed matchId, uint256 pot, uint256 rake, uint256[] rankedAgentIds, uint256[] payouts)",
  "event MatchRefunded(uint256 indexed matchId, uint256 pot)",
  "event MatchFrozen(uint256 indexed matchId, uint256 frozenUntil)",
  "event MatchUnfrozen(uint256 indexed matchId)",
  "event PayoutSent(uint256 indexed matchId, uint256 indexed agentId, address indexed owner, uint256 amount)",
  "event PayoutFailed(uint256 indexed matchId, uint256 indexed agentId, address indexed owner, uint256 amount)",
]);

export const PLATFORM_ABI = parseAbi([
  "event RequestCreated(uint256 indexed requestId, uint256 indexed agentId, bytes payload)",
  "event RequestFinalized(uint256 indexed requestId, uint8 status)",
]);
