// Minimal ABI fragments for the three starter commands.

export const REGISTRY_ABI = [
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
    type: "function", name: "totalAgents", stateMutability: "view",
    inputs: [], outputs: [{ type: "uint256" }],
  },
] as const;

export const SCHEDULER_ABI = [
  {
    type: "function", name: "pokeOpenNext", stateMutability: "nonpayable",
    inputs: [], outputs: [],
  },
  {
    type: "function", name: "matchesScheduled", stateMutability: "view",
    inputs: [], outputs: [{ type: "uint256" }],
  },
] as const;
