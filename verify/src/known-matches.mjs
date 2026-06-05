import { CONTRACTS } from "./config.mjs";

// Arena was redeployed several times as the protocol evolved (see docs/RECORDED_RUNS.md).
// A finalized match's events sit millions of blocks back, and Somnia caps eth_getLogs to a
// 1000-block range — so to verify a *historical* match the CLI needs (a) the exact Arena it
// ran on and (b) a starting block near its open. This registry bundles both for the matches
// documented in RECORDED_RUNS, so `npx bazaar-verify 104` works with no flags.
//
// For any other match: pass --arena and --from-block explicitly. A *live/recent* match on the
// current Arena needs neither — the CLI finds its open block by scanning back from chain head.

const ARENA_V3 = "0xb129ec7d06e3136517c188113fe9b8a10f882738"; // audit-aware (Phase 3/4)

export const KNOWN_MATCHES = {
  // matchId : { arena, fromBlock, label, audited }
  100: { arena: ARENA_V3, fromBlock: 392738646n, label: "Match #3 — first audited real-stakes", audited: true },
  101: { arena: ARENA_V3, fromBlock: 392754826n, label: "Season 1 #101 — first scheduler-driven", audited: false },
  102: { arena: ARENA_V3, fromBlock: 392758178n, label: "Season 1 #102 — scheduler-driven", audited: false },
  103: { arena: ARENA_V3, fromBlock: 392765923n, label: "Season 1 #103 — reactive callback captured", audited: false },
  104: { arena: ARENA_V3, fromBlock: 392814643n, label: "Season 2 #104 — every primitive in one run", audited: true },
};

/** Resolve the addresses + scan window for a match, merging CLI overrides over the registry. */
export function resolveMatch(matchId, opts = {}) {
  const known = KNOWN_MATCHES[Number(matchId)];
  const arena = opts.arena ?? known?.arena ?? CONTRACTS.arena;
  const fromBlock = opts.fromBlock ?? known?.fromBlock ?? null;
  return {
    arena,
    treasury: opts.treasury ?? CONTRACTS.treasury,
    platform: opts.platform ?? CONTRACTS.platform,
    fromBlock,
    label: known?.label ?? null,
    audited: known?.audited ?? null,
    knownEntry: !!known,
  };
}
