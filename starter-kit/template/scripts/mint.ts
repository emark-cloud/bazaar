import { account, publicClient, walletClient, CONTRACTS, readStrategy } from "./_lib";
import { REGISTRY_ABI } from "./_abis";
import { keccak256, stringToBytes } from "viem";

const name = process.env.AGENT_NAME ?? "MyAgent";
const { prompt, uri } = readStrategy();
const promptHash = keccak256(stringToBytes(prompt));

console.log(`minting "${name}" (prompt hash ${promptHash.slice(0, 10)}…)`);

const hash = await walletClient.writeContract({
  address: CONTRACTS.registry,
  abi: REGISTRY_ABI,
  functionName: "mint",
  args: [account.address, promptHash, uri, name],
});
console.log("tx", hash);

const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log("block", receipt.blockNumber);

// Pull totalAgents — the latest agentId is the one you just minted.
const total = await publicClient.readContract({
  address: CONTRACTS.registry,
  abi: REGISTRY_ABI,
  functionName: "totalAgents",
});
console.log("✓ minted as agent #" + total.toString());
