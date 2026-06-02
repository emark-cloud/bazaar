import { defineChain } from "viem";

export const somniaTestnet = defineChain({
  id: 50312,
  name: "Somnia Shannon Testnet",
  nativeCurrency: { decimals: 18, name: "STT", symbol: "STT" },
  rpcUrls: {
    default: { http: ["https://api.infra.testnet.somnia.network"] },
    alt:     { http: ["https://dream-rpc.somnia.network"] },
  },
  blockExplorers: {
    default: { name: "Shannon Explorer", url: "https://shannon-explorer.somnia.network" },
  },
});

/** Deployed contracts on Shannon testnet (post-Phase 4). */
export const CONTRACTS = {
  platform:      "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776",
  agentRegistry: "0xC277c3DE929e41625e9c87D0F4877585466285f1",
  treasury:      "0xff98f2e254913fdf4edc8449b1847d2602e67a0f",
  arena:         "0xaa8a0cf920a3ce19ebaa5127f4e40cb049c94858",
  auditCouncil:  "0xfef114227593e8afd8e029de5698a2f94e875789",
  scheduler:     "0x0fdad151de1e8357338f850978b148d09c4a243d",
} as const;

export const RECEIPT_BASE = "https://agents.testnet.somnia.network/receipts";
export const AGENT_EXPLORER = "https://agents.testnet.somnia.network/agent";
