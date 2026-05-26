import { account, publicClient, walletClient, CONTRACTS } from "./_lib";
import { SCHEDULER_ABI } from "./_abis";

// Pokes the scheduler to seat the next match. Same code path the reactivity precompile uses;
// any caller is allowed (no auth) since the scheduler still checks balance + joinable agents.
console.log(`poking scheduler at ${CONTRACTS.scheduler}…`);

const beforeBn = await publicClient.readContract({
  address: CONTRACTS.scheduler, abi: SCHEDULER_ABI, functionName: "matchesScheduled",
});
console.log("matchesScheduled before:", beforeBn.toString());

const hash = await walletClient.writeContract({
  account,
  address: CONTRACTS.scheduler,
  abi: SCHEDULER_ABI,
  functionName: "pokeOpenNext",
  args: [],
});
console.log("tx", hash);

const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log("block", receipt.blockNumber);

const afterBn = await publicClient.readContract({
  address: CONTRACTS.scheduler, abi: SCHEDULER_ABI, functionName: "matchesScheduled",
});
console.log("matchesScheduled after :", afterBn.toString());

if (afterBn > beforeBn) {
  console.log("✓ next match opened — open https://localhost:5173/live to watch.");
} else {
  console.log("× scheduler stalled (likely balance under threshold or no joinable agents).");
  console.log("  fund more with `pnpm fund 30` and try again.");
}
