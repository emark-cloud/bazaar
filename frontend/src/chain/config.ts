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
  arena:         "0x68be4fbf57b8a86f8becf70f20b5d1ab7798e0b3",
  auditCouncil:  "0xfef114227593e8afd8e029de5698a2f94e875789",
  scheduler:     "0xeeac435459bcb81ffed6f0451680198c71420f5f",
} as const;

export const RECEIPT_BASE = "https://agents.testnet.somnia.network/receipts";
export const AGENT_EXPLORER = "https://agents.testnet.somnia.network/agent";
