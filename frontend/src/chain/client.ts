import { createPublicClient, http, fallback } from "viem";
import { somniaTestnet } from "./config";

export const publicClient = createPublicClient({
  chain: somniaTestnet,
  transport: fallback([
    http("https://api.infra.testnet.somnia.network"),
    http("https://dream-rpc.somnia.network"),
  ]),
});
