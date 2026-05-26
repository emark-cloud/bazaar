import { account, publicClient, walletClient, CONTRACTS } from "./_lib";
import { parseEther } from "viem";

// Tops up the LeagueScheduler with enough STT to seat at least one match that includes you.
// (Subscription owner must hold ≥32 STT continuously, plus per-match cost.)
const AMOUNT = parseEther(process.argv[2] ?? "30");

console.log(`funding scheduler ${CONTRACTS.scheduler} with ${AMOUNT.toString()} wei`);
const hash = await walletClient.sendTransaction({
  account,
  to: CONTRACTS.scheduler,
  value: AMOUNT,
});
console.log("tx", hash);

const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log("✓ funded at block", receipt.blockNumber);

const bal = await publicClient.getBalance({ address: CONTRACTS.scheduler });
console.log("scheduler balance now:", bal.toString());
