// Hand-curated minimal ABIs covering the events + reads the frontend uses.
// Full ABIs live in contracts/out/* — this file inlines the relevant subset for bundle slimness.

export const AGENT_REGISTRY_ABI = [
  { type: "function", name: "totalAgents", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function", name: "getAgent", stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{
      type: "tuple",
      components: [
        { name: "promptHash", type: "bytes32" },
        { name: "promptURI",  type: "string"  },
        { name: "name",       type: "string"  },
        { name: "elo",        type: "uint16"  },
        { name: "matches",    type: "uint32"  },
        { name: "wins",       type: "uint32"  },
        { name: "joinable",   type: "bool"    },
      ],
    }],
  },
  {
    type: "function", name: "listJoinable", stateMutability: "view",
    inputs: [{ name: "cursor", type: "uint256" }, { name: "max", type: "uint256" }],
    outputs: [{ name: "ids", type: "uint256[]" }, { name: "nextCursor", type: "uint256" }],
  },
  {
    type: "function", name: "ownerOf", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "event", name: "EloUpdated", anonymous: false,
    inputs: [
      { indexed: true,  name: "agentId", type: "uint256" },
      { indexed: false, name: "oldElo",  type: "uint16"  },
      { indexed: false, name: "newElo",  type: "uint16"  },
      { indexed: false, name: "win",     type: "bool"    },
    ],
  },
  {
    type: "function", name: "mint", stateMutability: "nonpayable",
    inputs: [
      { name: "to",         type: "address" },
      { name: "promptHash", type: "bytes32" },
      { name: "promptURI",  type: "string"  },
      { name: "name_",      type: "string"  },
    ],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
] as const;

export const ARENA_ABI = [
  { type: "function", name: "nextMatchId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function", name: "getMatch", stateMutability: "view",
    inputs: [{ name: "matchId", type: "uint256" }],
    outputs: [
      { name: "kind", type: "uint8" },
      { name: "phase", type: "uint8" },
      { name: "agentIds", type: "uint256[]" },
      { name: "budgets", type: "uint256[]" },
      { name: "rounds", type: "uint8" },
      { name: "currentRound", type: "uint8" },
      { name: "currentTurnIdx", type: "uint8" },
      { name: "numLots", type: "uint8" },
    ],
  },
  {
    type: "function", name: "getLot", stateMutability: "view",
    inputs: [{ name: "matchId", type: "uint256" }, { name: "lotIndex", type: "uint8" }],
    outputs: [{
      type: "tuple",
      components: [
        { name: "category", type: "string" },
        { name: "feedUrl", type: "string" },
        { name: "feedSelector", type: "string" },
        { name: "feedDecimals", type: "uint8" },
        { name: "valueDivisor", type: "uint256" },
        { name: "valueHint", type: "string" },
        { name: "valueCommitment", type: "bytes32" },
        { name: "revealedValue", type: "uint256" },
        { name: "revealed", type: "bool" },
        { name: "ownerAgentId", type: "uint256" },
        { name: "paidPrice", type: "uint256" },
        { name: "coalitionPartner", type: "uint256" },
        { name: "standingOfferPrice", type: "uint256" },
        { name: "standingOfferBy", type: "uint256" },
        { name: "standingOfferIsBuy", type: "bool" },
      ],
    }],
  },
  // Writes — open a match from the browser. LotTemplate tuple order must match Arena.sol.
  {
    type: "function", name: "openExhibition", stateMutability: "payable",
    inputs: [
      { name: "agentIds", type: "uint256[]" },
      { name: "startingBudget", type: "uint256" },
      { name: "rounds", type: "uint8" },
      { name: "lotTemplates", type: "tuple[]", components: [
        { name: "category", type: "string" },
        { name: "feedUrl", type: "string" },
        { name: "feedSelector", type: "string" },
        { name: "feedDecimals", type: "uint8" },
        { name: "valueDivisor", type: "uint256" },
        { name: "valueHint", type: "string" },
      ]},
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function", name: "openRealStakes", stateMutability: "payable",
    inputs: [
      { name: "agentIds", type: "uint256[]" },
      { name: "entryStake", type: "uint256" },
      { name: "rounds", type: "uint8" },
      { name: "lotTemplates", type: "tuple[]", components: [
        { name: "category", type: "string" },
        { name: "feedUrl", type: "string" },
        { name: "feedSelector", type: "string" },
        { name: "feedDecimals", type: "uint8" },
        { name: "valueDivisor", type: "uint256" },
        { name: "valueHint", type: "string" },
      ]},
    ],
    outputs: [{ type: "uint256" }],
  },
  // Events — keep argument order/types EXACTLY as emitted; viem decodes against this.
  { type: "event", name: "MatchOpened", anonymous: false, inputs: [
    { indexed: true,  name: "matchId", type: "uint256" },
    { indexed: false, name: "kind", type: "uint8" },
    { indexed: false, name: "agentIds", type: "uint256[]" },
    { indexed: false, name: "rounds", type: "uint8" },
    { indexed: false, name: "numLots", type: "uint8" },
  ]},
  { type: "event", name: "LotPriced", anonymous: false, inputs: [
    { indexed: true,  name: "matchId", type: "uint256" },
    { indexed: false, name: "lotIndex", type: "uint8" },
    { indexed: false, name: "valueCommitment", type: "bytes32" },
  ]},
  { type: "event", name: "LotPricingRequested", anonymous: false, inputs: [
    { indexed: true,  name: "matchId", type: "uint256" },
    { indexed: false, name: "lotIndex", type: "uint8" },
    { indexed: false, name: "requestId", type: "uint256" },
  ]},
  { type: "event", name: "NegotiationStarted", anonymous: false, inputs: [
    { indexed: true,  name: "matchId", type: "uint256" },
  ]},
  { type: "event", name: "MoveRequested", anonymous: false, inputs: [
    { indexed: true,  name: "matchId", type: "uint256" },
    { indexed: false, name: "round", type: "uint8" },
    { indexed: false, name: "turnIdx", type: "uint8" },
    { indexed: false, name: "requestId", type: "uint256" },
    { indexed: false, name: "agentId", type: "uint256" },
  ]},
  { type: "event", name: "MoveMade", anonymous: false, inputs: [
    { indexed: true,  name: "matchId", type: "uint256" },
    { indexed: false, name: "round", type: "uint8" },
    { indexed: false, name: "turnIdx", type: "uint8" },
    { indexed: false, name: "agentId", type: "uint256" },
    { indexed: false, name: "move", type: "string" },
  ]},
  { type: "event", name: "MoveDefaulted", anonymous: false, inputs: [
    { indexed: true,  name: "matchId", type: "uint256" },
    { indexed: false, name: "round", type: "uint8" },
    { indexed: false, name: "turnIdx", type: "uint8" },
    { indexed: false, name: "agentId", type: "uint256" },
    { indexed: false, name: "reason", type: "string" },
  ]},
  { type: "event", name: "MoveRejected", anonymous: false, inputs: [
    { indexed: true,  name: "matchId", type: "uint256" },
    { indexed: false, name: "round", type: "uint8" },
    { indexed: false, name: "turnIdx", type: "uint8" },
    { indexed: false, name: "agentId", type: "uint256" },
    { indexed: false, name: "raw", type: "string" },
    { indexed: false, name: "reason", type: "string" },
  ]},
  { type: "event", name: "CoalitionFormed", anonymous: false, inputs: [
    { indexed: true,  name: "matchId", type: "uint256" },
    { indexed: false, name: "lotIndex", type: "uint8" },
    { indexed: false, name: "agentA", type: "uint256" },
    { indexed: false, name: "agentB", type: "uint256" },
    { indexed: false, name: "price",  type: "uint256" },
  ]},
  { type: "event", name: "LotSold", anonymous: false, inputs: [
    { indexed: true,  name: "matchId", type: "uint256" },
    { indexed: false, name: "lotIndex", type: "uint8" },
    { indexed: false, name: "buyerAgentId", type: "uint256" },
    { indexed: false, name: "price", type: "uint256" },
  ]},
  { type: "event", name: "LotRevealed", anonymous: false, inputs: [
    { indexed: true,  name: "matchId", type: "uint256" },
    { indexed: false, name: "lotIndex", type: "uint8" },
    { indexed: false, name: "trueValue", type: "uint256" },
  ]},
  { type: "event", name: "WinnerDeclared", anonymous: false, inputs: [
    { indexed: true,  name: "matchId", type: "uint256" },
    { indexed: true,  name: "winnerAgentId", type: "uint256" },
    { indexed: false, name: "winnerScore", type: "int256" },
  ]},
  { type: "event", name: "AgentForfeited", anonymous: false, inputs: [
    { indexed: true,  name: "matchId", type: "uint256" },
    { indexed: false, name: "agentId", type: "uint256" },
  ]},
] as const;

export const TREASURY_ABI = [
  { type: "function", name: "seasonFund", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function", name: "getEscrow", stateMutability: "view",
    inputs: [{ name: "matchId", type: "uint256" }],
    outputs: [
      { name: "entryStake", type: "uint256" },
      { name: "pot", type: "uint256" },
      { name: "agentIds", type: "uint256[]" },
      { name: "owners", type: "address[]" },
      { name: "settled", type: "bool" },
      { name: "refunded", type: "bool" },
      { name: "frozenUntil", type: "uint256" },
    ],
  },
  { type: "event", name: "MatchSettled", anonymous: false, inputs: [
    { indexed: true, name: "matchId", type: "uint256" },
    { indexed: false, name: "pot", type: "uint256" },
    { indexed: false, name: "rake", type: "uint256" },
    { indexed: false, name: "rankedAgentIds", type: "uint256[]" },
    { indexed: false, name: "payouts", type: "uint256[]" },
  ]},
  { type: "event", name: "PayoutSent", anonymous: false, inputs: [
    { indexed: true, name: "matchId", type: "uint256" },
    { indexed: true, name: "agentId", type: "uint256" },
    { indexed: true, name: "owner",   type: "address" },
    { indexed: false, name: "amount", type: "uint256" },
  ]},
] as const;

export const AUDIT_COUNCIL_ABI = [
  {
    type: "function", name: "getAudit", stateMutability: "view",
    inputs: [{ name: "matchId", type: "uint256" }],
    outputs: [
      { name: "status", type: "uint8" },
      { name: "vrfRequestId", type: "uint256" },
      { name: "auditorIds", type: "uint256[]" },
      { name: "verdictsDone", type: "uint8" },
      { name: "verdictsSuspect", type: "uint8" },
      { name: "verdictsClean", type: "uint8" },
      { name: "parseChecksDone", type: "uint8" },
      { name: "parseChecksSuspect", type: "uint8" },
      { name: "appealUntil", type: "uint256" },
    ],
  },
  { type: "event", name: "AuditStarted", anonymous: false, inputs: [
    { indexed: true,  name: "matchId", type: "uint256" },
    { indexed: false, name: "vrfRequestId", type: "uint256" },
    { indexed: false, name: "competitorIds", type: "uint256[]" },
  ]},
  { type: "event", name: "AuditFinalized", anonymous: false, inputs: [
    { indexed: true,  name: "matchId", type: "uint256" },
    { indexed: false, name: "suspect", type: "bool" },
    { indexed: false, name: "verdictsSuspect", type: "uint8" },
    { indexed: false, name: "verdictsClean",   type: "uint8" },
    { indexed: false, name: "parseChecksSuspect", type: "uint8" },
  ]},
] as const;

export const SCHEDULER_ABI = [
  { type: "function", name: "matchesScheduled", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "callbacksReceived", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "subscriptionId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "entryStake", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "seatCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "rounds", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "operatingPerMatch", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "minBalanceThreshold", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  // Write — manual league advance (auto-seats top-N joinable, scheduler funds the pot).
  { type: "function", name: "pokeOpenNext", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "event", name: "MatchScheduled", anonymous: false, inputs: [
    { indexed: true,  name: "matchId", type: "uint256" },
    { indexed: false, name: "agentIds", type: "uint256[]" },
  ]},
  { type: "event", name: "SchedulerStalled", anonymous: false, inputs: [
    { indexed: false, name: "balance", type: "uint256" },
    { indexed: false, name: "required", type: "uint256" },
  ]},
] as const;
