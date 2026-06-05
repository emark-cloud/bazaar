import { createPublicClient, http, fallback, isAddress, getAddress } from "viem";
import { somniaTestnet } from "./config.mjs";
import { resolveMatch } from "./known-matches.mjs";
import { runVerification } from "./verify.mjs";
import { c, setColor, renderChecks } from "./ui.mjs";

const HELP = `
bazaar-verify — replay a Bazaar match from live Somnia state and assert it checks out.

Usage:
  npx bazaar-verify <matchId> [options]

Examples:
  npx bazaar-verify 104              # the full-stack showcase match (bundled)
  npx bazaar-verify 100             # first audited real-stakes match
  npx bazaar-verify 207 --from-block 393100000   # a match not in the registry

Options:
  --arena <addr>        Arena address this match ran on (default: registry or current)
  --treasury <addr>     Treasury address (default: current deployment)
  --platform <addr>     Agent-platform address (default: current deployment)
  --from-block <n>      Block to start the event scan (required for matches not bundled
                        and not near chain head)
  --window <n>          How many blocks to scan from --from-block (default: 15000)
  --rpc <url>           Override the Somnia RPC endpoint
  --json                Emit machine-readable JSON instead of the report
  --no-color            Disable ANSI colors
  -h, --help            Show this help

What it checks, all against live testnet:
  bytecode         every Bazaar contract is actually deployed
  events           the match replays from on-chain events with an intact lifecycle
  receipts         each move's request was finalized by platform consensus (Success)
  settlement math  5% rake + rank weights recomputed and asserted == on-chain payouts
  payouts          STT actually reached the right NFT owners; winner ranked #1
`;

function parseArgs(argv) {
  const opts = { window: 15000 };
  let matchId = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "-h" || a === "--help") opts.help = true;
    else if (a === "--json") opts.json = true;
    else if (a === "--no-color") opts.noColor = true;
    else if (a === "--arena") opts.arena = next();
    else if (a === "--treasury") opts.treasury = next();
    else if (a === "--platform") opts.platform = next();
    else if (a === "--rpc") opts.rpc = next();
    else if (a === "--from-block") opts.fromBlock = BigInt(next());
    else if (a === "--window") opts.window = Number(next());
    else if (/^\d+$/.test(a) && matchId === null) matchId = a;
    else throw new Error(`unrecognized argument: ${a}`);
  }
  return { matchId, opts };
}

function checkAddr(label, v) {
  if (v && !isAddress(v)) throw new Error(`${label} is not a valid address: ${v}`);
  return v ? getAddress(v) : v;
}

export async function main(argv) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (e) {
    console.error(c.red(e.message));
    console.error("Run with --help for usage.");
    return 2;
  }
  const { matchId, opts } = parsed;
  if (opts.help || matchId === null) {
    console.log(HELP);
    return matchId === null && !opts.help ? 2 : 0;
  }
  if (opts.noColor) setColor(false);

  const overrides = {
    arena: checkAddr("--arena", opts.arena),
    treasury: checkAddr("--treasury", opts.treasury),
    platform: checkAddr("--platform", opts.platform),
    fromBlock: opts.fromBlock,
  };
  const resolved = resolveMatch(matchId, overrides);

  const transport = opts.rpc
    ? http(opts.rpc)
    : fallback(somniaTestnet.rpcUrls.default.http.map((u) => http(u)));
  const client = createPublicClient({ chain: somniaTestnet, transport });

  // Header
  if (!opts.json) {
    console.log("");
    console.log(c.bold(c.cyan(`bazaar-verify`)) + c.gray(`  ·  Somnia Shannon testnet (chain 50312)`));
    console.log(c.gray("─".repeat(64)));
    console.log(`  match     ${c.bold("#" + matchId)}${resolved.label ? c.gray("  " + resolved.label) : ""}`);
    console.log(`  arena     ${resolved.arena}${resolved.knownEntry ? "" : c.gray(opts.arena ? " (--arena)" : " (current deployment)")}`);
  }

  // Connectivity + chain id
  let chainId;
  try {
    chainId = await client.getChainId();
  } catch (e) {
    console.error(c.red(`\nCannot reach Somnia RPC: ${e.shortMessage || e.message}`));
    return 1;
  }
  if (chainId !== 50312) {
    console.error(c.red(`\nConnected chain id ${chainId} ≠ 50312 (Somnia testnet).`));
    return 1;
  }

  let result;
  try {
    result = await runVerification(client, { matchId: BigInt(matchId), resolved, windowBlocks: opts.window });
  } catch (e) {
    console.error(c.red(`\nVerification error: ${e.shortMessage || e.message}`));
    return 1;
  }

  const passed = result.checks.filter((c) => c.status === "pass").length;
  const failed = result.checks.filter((c) => c.status === "fail").length;
  const skipped = result.checks.filter((c) => c.status === "skip").length;

  if (opts.json) {
    const replacer = (_k, v) => (typeof v === "bigint" ? v.toString() : v);
    console.log(JSON.stringify({ ok: failed === 0, summary: { passed, failed, skipped }, ...result }, replacer, 2));
    return failed === 0 ? 0 : 1;
  }

  if (result.info.kind) {
    console.log(`  kind      ${result.info.kind} · ${result.info.agentIds?.length} agents · ${result.info.rounds} rounds · ${result.info.numLots} lots`);
  }
  if (result.info.window) {
    console.log(`  scanned   blocks ${result.info.window.fromBlock}–${result.info.window.toBlock}`);
  }
  console.log(c.gray("─".repeat(64)));
  console.log(renderChecks(result.checks));
  console.log(c.gray("─".repeat(64)));

  const verdict = failed === 0
    ? c.green(c.bold(`✓ VERIFIED`)) + c.gray(`  match #${matchId} is real on-chain`)
    : c.red(c.bold(`✗ FAILED`)) + c.gray(`  ${failed} check(s) did not pass`);
  console.log(`  ${verdict}   ${c.gray(`(${passed} pass · ${failed} fail · ${skipped} skip)`)}`);
  console.log("");
  return failed === 0 ? 0 : 1;
}
