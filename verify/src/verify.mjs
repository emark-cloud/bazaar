import { formatEther } from "viem";
import { ARENA_ABI, TREASURY_ABI, PLATFORM_ABI } from "./abis.mjs";
import { CONTRACTS, RECEIPT_BASE, RESPONSE_STATUS, STATUS_SUCCESS, BLOCK_PAGE } from "./config.mjs";

/** Fetch decoded logs for one contract, paging under Somnia's 1000-block getLogs cap. */
async function getLogsPaged(client, { address, abi, eventName, fromBlock, toBlock }) {
  const out = [];
  for (let from = fromBlock; from <= toBlock; from += BLOCK_PAGE + 1n) {
    const to = from + BLOCK_PAGE > toBlock ? toBlock : from + BLOCK_PAGE;
    const logs = await client.getContractEvents({ address, abi, eventName, fromBlock: from, toBlock: to });
    for (const log of logs) {
      out.push({
        eventName: log.eventName,
        args: log.args,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
      });
    }
  }
  out.sort((a, b) => (a.blockNumber < b.blockNumber ? -1 : a.blockNumber > b.blockNumber ? 1 : 0));
  return out;
}

/** Walk MatchOpened events back from head to find a recent match's open block. Bounded. */
async function findOpenBlock(client, address, matchId, { maxPages = 200, budgetMs = 8000 } = {}) {
  const head = await client.getBlockNumber();
  const started = Date.now();
  let to = head;
  for (let page = 0; page < maxPages && to > 0n; page++) {
    if (Date.now() - started > budgetMs) break;
    const from = to > BLOCK_PAGE ? to - BLOCK_PAGE : 0n;
    try {
      const logs = await client.getContractEvents({ address, abi: ARENA_ABI, eventName: "MatchOpened", fromBlock: from, toBlock: to });
      for (const log of logs) if (log.args.matchId === matchId) return log.blockNumber;
    } catch { /* skip a bad page */ }
    if (from === 0n) break;
    to = from - 1n;
  }
  return null;
}

/** Treasury rank-weighted payout percentages — must match Treasury.sol `_weights` exactly. */
function weights(n) {
  if (n === 1) return [100n];
  if (n === 2) return [70n, 30n];
  if (n === 3) return [55n, 30n, 15n];
  if (n === 4) return [50n, 28n, 15n, 7n];
  const w = new Array(n).fill(0n);
  w[0] = 40n; w[1] = 25n; w[2] = 18n; w[3] = 10n; w[4] = 7n;
  return w;
}

/** Recompute Treasury.settleMatch payouts from the pot + rank count (5% rake, dust → winner). */
function computePayouts(pot, n) {
  const rake = (pot * 500n) / 10000n;
  const distributable = pot - rake;
  const w = weights(n);
  const payouts = w.map((wi) => (distributable * wi) / 100n);
  const totalPaid = payouts.reduce((a, b) => a + b, 0n);
  if (totalPaid < distributable) payouts[0] += distributable - totalPaid;
  return { rake, distributable, payouts };
}

const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Verify one Bazaar match end-to-end against live Somnia state.
 * Returns { info, checks } — checks each have {name, status: pass|fail|skip, detail, lines}.
 */
export async function runVerification(client, { matchId, resolved, windowBlocks }) {
  const checks = [];
  const info = { matchId, label: resolved.label, arena: resolved.arena };
  const add = (name, status, detail, lines) => checks.push({ name, status, detail, lines });

  // ── Check 1: deployed bytecode ──────────────────────────────────────────────
  const targets = {
    Arena: resolved.arena,
    Treasury: resolved.treasury,
    AgentRegistry: CONTRACTS.agentRegistry,
    "Agent platform": resolved.platform,
    AuditCouncil: CONTRACTS.auditCouncil,
  };
  const sizes = {};
  let allDeployed = true;
  for (const [name, addr] of Object.entries(targets)) {
    const code = await client.getCode({ address: addr }).catch(() => undefined);
    const size = code && code !== "0x" ? (code.length - 2) / 2 : 0;
    sizes[name] = size;
    if (size === 0) allDeployed = false;
  }
  add(
    "bytecode",
    allDeployed ? "pass" : "fail",
    allDeployed ? "all 5 contracts deployed on-chain" : "missing contract bytecode",
    Object.entries(sizes).map(([n, s]) => `${n.padEnd(15)} ${s ? s + " bytes @ " + targets[n] : "NOT DEPLOYED @ " + targets[n]}`),
  );

  // ── Resolve scan window ─────────────────────────────────────────────────────
  const head = await client.getBlockNumber();
  let fromBlock = resolved.fromBlock;
  if (fromBlock == null) {
    fromBlock = await findOpenBlock(client, resolved.arena, matchId);
    if (fromBlock == null) {
      add("events", "fail", `could not locate MatchOpened for match ${matchId}`, [
        "This match isn't in the bundled registry and wasn't found near chain head.",
        "Re-run with --arena <addr> --from-block <openBlock> (see docs/RECORDED_RUNS.md).",
      ]);
      return { info, checks };
    }
  }
  const toBlock = fromBlock + BigInt(windowBlocks) > head ? head : fromBlock + BigInt(windowBlocks);
  info.window = { fromBlock, toBlock };

  // ── Fetch this match's Arena events ─────────────────────────────────────────
  const arenaAll = await getLogsPaged(client, { address: resolved.arena, abi: ARENA_ABI, fromBlock, toBlock });
  const ev = arenaAll.filter((e) => e.args?.matchId === matchId);
  const byName = (n) => ev.filter((e) => e.eventName === n);

  const opened = byName("MatchOpened")[0];
  const settled = byName("MatchSettled")[0];
  const declared = byName("WinnerDeclared")[0];

  if (!opened) {
    add("events", "fail", `no MatchOpened for match ${matchId} in blocks ${fromBlock}–${toBlock}`, [
      "Widen the window with --window <blocks>, or fix --from-block.",
    ]);
    return { info, checks };
  }

  const kind = Number(opened.args.kind); // 0 = Exhibition, 1 = RealStakes
  const numLots = Number(opened.args.numLots);
  const rounds = Number(opened.args.rounds);
  const agentIds = opened.args.agentIds.map(String);
  info.kind = kind === 0 ? "Exhibition" : "RealStakes";
  info.agentIds = agentIds;
  info.rounds = rounds;
  info.numLots = numLots;
  info.openBlock = opened.blockNumber;

  // ── Check 2: events / replay ────────────────────────────────────────────────
  const moveReq = byName("MoveRequested");
  const moveMade = byName("MoveMade");
  const moveDef = byName("MoveDefaulted");
  const moveRej = byName("MoveRejected");
  const lotPriced = byName("LotPriced");
  const lotRevealed = byName("LotRevealed");
  const totalTurns = moveMade.length + moveDef.length + moveRej.length;

  const eProblems = [];
  if (lotPriced.length < numLots) eProblems.push(`only ${lotPriced.length}/${numLots} lots priced`);
  if (lotRevealed.length < numLots) eProblems.push(`only ${lotRevealed.length}/${numLots} lots revealed`);
  if (!settled) eProblems.push("no MatchSettled");
  if (!declared) eProblems.push("no WinnerDeclared");
  if (totalTurns === 0) eProblems.push("no moves recorded");

  // Every turn that produced a move must have a matching MoveRequested (request → response linkage).
  const reqTurns = new Set(moveReq.map((m) => `${m.args.round}:${m.args.turnIdx}`));
  let unlinked = 0;
  for (const m of [...moveMade, ...moveDef, ...moveRej]) {
    if (!reqTurns.has(`${m.args.round}:${m.args.turnIdx}`)) unlinked++;
  }
  if (unlinked > 0) eProblems.push(`${unlinked} move(s) with no MoveRequested`);

  // Winner consistency: WinnerDeclared must agree with MatchSettled's winner + that agent's score.
  let winnerAgentId = null, winnerScore = null;
  if (settled && declared) {
    winnerAgentId = String(settled.args.winnerAgentId);
    const idx = settled.args.agentIds.findIndex((a) => a === settled.args.winnerAgentId);
    winnerScore = idx >= 0 ? settled.args.scores[idx] : null;
    if (String(declared.args.winnerAgentId) !== winnerAgentId) eProblems.push("WinnerDeclared ≠ MatchSettled winner");
    if (winnerScore != null && declared.args.winnerScore !== winnerScore) eProblems.push("winner score mismatch");
  }
  info.winnerAgentId = winnerAgentId;
  info.settleBlock = settled?.blockNumber ?? null;

  add(
    "events",
    eProblems.length === 0 ? "pass" : "fail",
    eProblems.length === 0
      ? `replayed ${totalTurns} turns over ${rounds} rounds; lifecycle intact`
      : eProblems.join("; "),
    [
      `MatchOpened → ${lotPriced.length} LotPriced → NegotiationStarted → ${totalTurns} turns → ${lotRevealed.length} LotRevealed → MatchSettled → WinnerDeclared`,
      `moves: ${moveMade.length} made · ${moveDef.length} defaulted · ${moveRej.length} rejected`,
      winnerAgentId ? `winner: agent ${winnerAgentId} (score ${winnerScore})` : "",
    ].filter(Boolean),
  );

  // ── Check 3: consensus trail (platform RequestFinalized) ────────────────────
  // Each move's requestId must be a real platform request finalized on-chain by consensus.
  const reqIdByTurn = new Map();
  for (const m of moveReq) reqIdByTurn.set(`${m.args.round}:${m.args.turnIdx}`, m.args.requestId);
  const madeReqIds = moveMade
    .map((m) => reqIdByTurn.get(`${m.args.round}:${m.args.turnIdx}`))
    .filter((x) => x !== undefined);

  if (madeReqIds.length === 0) {
    add("receipts", "skip", "no successful move requests to verify", []);
  } else {
    const evMin = ev[0].blockNumber;
    const evMax = ev[ev.length - 1].blockNumber;
    const fin = await getLogsPaged(client, {
      address: resolved.platform, abi: PLATFORM_ABI, eventName: "RequestFinalized",
      fromBlock: evMin, toBlock: evMax,
    });
    const statusById = new Map(fin.map((f) => [f.args.requestId, Number(f.args.status)]));
    let okCount = 0;
    const missing = [];
    for (const id of madeReqIds) {
      const st = statusById.get(id);
      if (st === STATUS_SUCCESS) okCount++;
      else missing.push(`req ${id}: ${st === undefined ? "no RequestFinalized in window" : RESPONSE_STATUS[st]}`);
    }
    add(
      "receipts",
      missing.length === 0 ? "pass" : "fail",
      missing.length === 0
        ? `${okCount}/${madeReqIds.length} moves finalized Success by platform consensus`
        : `${missing.length} move request(s) not Success`,
      [
        ...missing.slice(0, 4),
        `consensus receipts (open in a browser): ${RECEIPT_BASE}/${madeReqIds[0]}`,
      ],
    );
  }

  // ── Treasury checks (RealStakes only) ───────────────────────────────────────
  if (kind !== 1) {
    add("settlement math", "skip", "Exhibition match — no Treasury escrow", []);
    add("payouts", "skip", "Exhibition match — no STT settlement", []);
    return { info, checks };
  }

  const tAll = await getLogsPaged(client, { address: resolved.treasury, abi: TREASURY_ABI, fromBlock, toBlock });
  const tev = tAll.filter((e) => e.args?.matchId === matchId);
  const escrow = tev.find((e) => e.eventName === "MatchEscrowed");
  const tSettled = tev.find((e) => e.eventName === "MatchSettled");
  const refunded = tev.find((e) => e.eventName === "MatchRefunded");
  const payoutSent = tev.filter((e) => e.eventName === "PayoutSent");
  const payoutFailed = tev.filter((e) => e.eventName === "PayoutFailed");

  if (refunded && !tSettled) {
    add("settlement math", "skip", "match was refunded (audit suspect / void) — no rank payout", [
      `MatchRefunded pot = ${formatEther(refunded.args.pot)} STT`,
    ]);
    add("payouts", escrow && refunded.args.pot === escrow.args.pot ? "pass" : "fail",
      escrow && refunded.args.pot === escrow.args.pot ? "refunded pot equals escrowed pot" : "refund pot ≠ escrow pot", []);
    return { info, checks };
  }

  if (!tSettled) {
    add("settlement math", "fail", "no Treasury MatchSettled found", [
      "Match may still be frozen for audit, or the window misses settlement — try --window.",
    ]);
    add("payouts", "fail", "no payout events found", []);
    return { info, checks };
  }

  // ── Check 4: settlement math (recompute vs on-chain payouts) ────────────────
  const pot = tSettled.args.pot;
  const onchainRake = tSettled.args.rake;
  const ranked = tSettled.args.rankedAgentIds;
  const onchainPayouts = tSettled.args.payouts;
  const { rake, payouts } = computePayouts(pot, ranked.length);
  const sumPayouts = onchainPayouts.reduce((a, b) => a + b, 0n);

  const mProblems = [];
  if (rake !== onchainRake) mProblems.push(`rake: computed ${formatEther(rake)} ≠ on-chain ${formatEther(onchainRake)}`);
  if (!eq(payouts, [...onchainPayouts])) mProblems.push("recomputed payouts ≠ on-chain payouts");
  if (sumPayouts + onchainRake !== pot) mProblems.push("payouts + rake ≠ pot (conservation)");
  if (escrow && escrow.args.pot !== pot) mProblems.push("settled pot ≠ escrowed pot");

  add(
    "settlement math",
    mProblems.length === 0 ? "pass" : "fail",
    mProblems.length === 0
      ? `recomputed 5% rake + rank weights match on-chain payouts exactly`
      : mProblems.join("; "),
    [
      `pot ${formatEther(pot)} STT = rake ${formatEther(onchainRake)} + payouts ${formatEther(sumPayouts)}`,
      `ranked agents [${ranked.map(String).join(", ")}]`,
      `payouts (STT) [${onchainPayouts.map((p) => formatEther(p)).join(", ")}]`,
    ],
  );

  // ── Check 5: payouts actually sent to the right owners ───────────────────────
  const pProblems = [];
  // winner (rank 0) must equal the Arena-declared winner
  if (winnerAgentId && String(ranked[0]) !== winnerAgentId) {
    pProblems.push(`rank-0 agent ${ranked[0]} ≠ declared winner ${winnerAgentId}`);
  }
  const sentByAgent = new Map(payoutSent.map((p) => [String(p.args.agentId), p.args.amount]));
  const failedByAgent = new Map(payoutFailed.map((p) => [String(p.args.agentId), p.args.amount]));
  let sentTotal = 0n;
  for (let i = 0; i < ranked.length; i++) {
    const aid = String(ranked[i]);
    const expected = onchainPayouts[i];
    if (expected === 0n) continue;
    const sent = sentByAgent.get(aid);
    const failed = failedByAgent.get(aid);
    if (sent !== undefined) {
      sentTotal += sent;
      if (sent !== expected) pProblems.push(`agent ${aid}: paid ${formatEther(sent)} ≠ owed ${formatEther(expected)}`);
    } else if (failed !== undefined) {
      // routed to season fund on a failed owner transfer — acceptable, but flag it
      if (failed !== expected) pProblems.push(`agent ${aid}: failed-payout ${formatEther(failed)} ≠ owed ${formatEther(expected)}`);
    } else {
      pProblems.push(`agent ${aid}: owed ${formatEther(expected)} but no PayoutSent/PayoutFailed`);
    }
  }
  add(
    "payouts",
    pProblems.length === 0 ? "pass" : "fail",
    pProblems.length === 0
      ? `${payoutSent.length} payouts delivered to NFT owners; winner ranked #1`
      : pProblems.join("; "),
    [
      `PayoutSent total ${formatEther(sentTotal)} STT${payoutFailed.length ? ` · ${payoutFailed.length} routed to season fund` : ""}`,
    ],
  );

  return { info, checks };
}
