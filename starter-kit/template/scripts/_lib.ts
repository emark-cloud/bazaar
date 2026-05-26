import "dotenv/config";
import { createPublicClient, createWalletClient, http, defineChain, fallback } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "node:fs";

export const chain = defineChain({
  id: Number(process.env.CHAIN_ID ?? 50312),
  name: "Somnia Shannon Testnet",
  nativeCurrency: { decimals: 18, name: "STT", symbol: "STT" },
  rpcUrls: {
    default: { http: [process.env.TESTNET_RPC ?? "https://api.infra.testnet.somnia.network"] },
  },
});

function envAddr(k: string): `0x${string}` {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env: ${k}`);
  return v as `0x${string}`;
}

export const CONTRACTS = {
  registry:  envAddr("AGENT_REGISTRY"),
  arena:     envAddr("ARENA"),
  treasury:  envAddr("TREASURY"),
  scheduler: envAddr("LEAGUE_SCHEDULER"),
};

export const account = privateKeyToAccount(
  (process.env.PRIVATE_KEY ?? "0x0") as `0x${string}`
);

export const publicClient = createPublicClient({
  chain,
  transport: fallback([
    http(process.env.TESTNET_RPC ?? "https://api.infra.testnet.somnia.network"),
    http(process.env.TESTNET_RPC_ALT ?? "https://dream-rpc.somnia.network"),
  ]),
});

export const walletClient = createWalletClient({
  chain,
  transport: http(process.env.TESTNET_RPC ?? "https://api.infra.testnet.somnia.network"),
  account,
});

export function readStrategy(): { prompt: string; uri: string } {
  const path = process.env.STRATEGY_PATH ?? "./persona/strategy.md";
  const prompt = readFileSync(path, "utf8");
  // For the starter kit we pin the prompt to an inline ipfs-style URI; replace with a real
  // pinning step (Pinata, Web3.Storage) for production.
  const uri = `bzaragent://${process.env.AGENT_NAME ?? "agent"}/strategy.md`;
  return { prompt, uri };
}
