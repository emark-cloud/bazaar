import { defineChain } from "viem";

/** Somnia Shannon testnet — chain 50312. */
export const somniaTestnet = defineChain({
  id: 50312,
  name: "Somnia Shannon Testnet",
  nativeCurrency: { decimals: 18, name: "STT", symbol: "STT" },
  rpcUrls: {
    default: {
      http: [
        "https://api.infra.testnet.somnia.network",
        "https://dream-rpc.somnia.network",
      ],
    },
  },
  blockExplorers: {
    default: { name: "Shannon Explorer", url: "https://shannon-explorer.somnia.network" },
  },
});

/**
 * Current live deployment (mirrors frontend/src/chain/config.ts + README).
 * AgentRegistry / Treasury / AuditCouncil / platform are stable across Arena redeploys;
 * Arena and LeagueScheduler get rev'd, so per-match Arena addresses live in known-matches.mjs.
 */
export const CONTRACTS = {
  platform: "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776",
  agentRegistry: "0xC277c3DE929e41625e9c87D0F4877585466285f1",
  treasury: "0xff98f2e254913fdf4edc8449b1847d2602e67a0f",
  arena: "0xfffe8fe466df19ec3a50887c8390ef06cdae262f",
  auditCouncil: "0xfef114227593e8afd8e029de5698a2f94e875789",
  scheduler: "0x49172f42cce918e2d37d13cca779fee786321947",
};

/** Human-readable receipt page (client-rendered; opened in a browser, not fetched). */
export const RECEIPT_BASE = "https://agents.testnet.somnia.network/receipts";

/** ResponseStatus enum from IAgentPlatform.sol: None,Pending,Success,Failed,TimedOut. */
export const RESPONSE_STATUS = ["None", "Pending", "Success", "Failed", "TimedOut"];
export const STATUS_SUCCESS = 2;

/** Somnia RPC caps eth_getLogs to a 1000-block range — page below that. */
export const BLOCK_PAGE = 950n;
