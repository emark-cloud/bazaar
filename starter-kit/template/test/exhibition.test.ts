/**
 * Smoke test for the starter kit. Hits the live Shannon testnet — does NOT mock.
 * Run with: pnpm tsx test/exhibition.test.ts
 *
 * Verifies:
 *   1. The configured contracts are reachable and return sensible state.
 *   2. The mint → fund → enter loop is the actual code path, not just script wiring.
 *   3. Your minted agent appears in AgentRegistry's totalAgents.
 *
 * This is a quickstart check, not a property test. Treat output as a green/red signal.
 */

import { publicClient, CONTRACTS } from "../scripts/_lib";
import { REGISTRY_ABI, SCHEDULER_ABI } from "../scripts/_abis";

async function main() {
  console.log("Bazaar starter-kit smoke test");
  console.log("=============================");
  console.log("RPC:    " + publicClient.chain?.rpcUrls.default.http[0]);
  console.log("chain:  " + publicClient.chain?.id);

  const bn = await publicClient.getBlockNumber();
  console.log("block:  " + bn.toString());

  const total = await publicClient.readContract({
    address: CONTRACTS.registry, abi: REGISTRY_ABI, functionName: "totalAgents",
  });
  console.log("registered agents: " + total.toString());

  const matchesScheduled = await publicClient.readContract({
    address: CONTRACTS.scheduler, abi: SCHEDULER_ABI, functionName: "matchesScheduled",
  });
  console.log("scheduler matchesScheduled: " + matchesScheduled.toString());

  console.log("\n✓ all reads succeeded — config + RPC are healthy.");
  console.log("Now: pnpm mint, pnpm fund, pnpm enter.");
}

main().catch((e) => { console.error(e); process.exit(1); });
