import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchAllAgents, fetchAllLots, fetchMatch, fetchAuditState } from "../chain/reads";
import { findLatestMatchId, fetchMatchEvents, eventsToMoves } from "../chain/events";
import type { Agent, MoveEntry } from "../chain/types";
import { AgentPanel } from "../components/AgentPanel";
import { NegotiationStream } from "../components/NegotiationStream";
import { LotCard } from "../components/LotCard";
import { SigilTile } from "../components/SigilTile";
import { CountUp } from "../components/CountUp";
import { personaColorOf } from "../sigils/personas";
import { MATCH_PHASE, AUDIT_STATUS } from "../chain/types";

interface MatchSnapshot {
  matchId: bigint;
  phase: number;
  kind: number;
  agentIds: readonly bigint[];
  budgets: readonly bigint[];
  rounds: number;
  currentRound: number;
  currentTurnIdx: number;
  numLots: number;
}

interface MatchScores {
  scoreByAgent: Map<string, bigint>;
}

export default function LiveMatch() {
  const params = useParams();
  const nav = useNavigate();
  const [matchId, setMatchId] = useState<bigint | null>(
    params.id ? BigInt(params.id) : null
  );
  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(null);
  const [lots, setLots] = useState<any[]>([]);
  const [moves, setMoves] = useState<MoveEntry[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [audit, setAudit] = useState<{ status: number; auditorIds: readonly bigint[]; verdictsSuspect: number; verdictsClean: number; parseChecksSuspect: number } | null>(null);

  // resolve match id
  useEffect(() => {
    if (matchId) return;
    (async () => {
      const id = await findLatestMatchId();
      if (id) {
        setMatchId(id);
        nav(`/live/${id.toString()}`, { replace: true });
      }
    })();
  }, [matchId, nav]);

  // load + poll snapshot
  useEffect(() => {
    if (!matchId) return;
    let cancel = false;
    async function tick() {
      try {
        const [snap, allLots, allAgents] = await Promise.all([
          fetchMatch(matchId!),
          fetchMatchAndLots(matchId!),
          fetchAllAgents(),
        ]);
        if (cancel) return;
        setSnapshot(snap);
        setLots(allLots);
        setAgents(allAgents);
        try {
          const a = await fetchAuditState(matchId!);
          setAudit({
            status: Number(a[0]),
            auditorIds: a[2] as readonly bigint[],
            verdictsSuspect: Number(a[4]),
            verdictsClean: Number(a[5]),
            parseChecksSuspect: Number(a[7]),
          });
        } catch { setAudit(null); }
      } catch (e) {
        console.warn("snapshot fetch failed", e);
      }
    }
    tick();
    const id = setInterval(tick, 6000);
    return () => { cancel = true; clearInterval(id); };
  }, [matchId]);

  // load + poll move log
  useEffect(() => {
    if (!matchId) return;
    let cancel = false;
    async function tick() {
      try {
        const evs = await fetchMatchEvents(matchId!);
        if (!cancel) setMoves(eventsToMoves(evs));
      } catch (e) { console.warn("events fetch failed", e); }
    }
    tick();
    const id = setInterval(tick, 8000);
    return () => { cancel = true; clearInterval(id); };
  }, [matchId]);

  const agentById = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const a of agents) map.set(a.id.toString(), a);
    return map;
  }, [agents]);

  const scoreByAgent: MatchScores["scoreByAgent"] = useMemo(() => {
    const m = new Map<string, bigint>();
    for (const lot of lots) {
      if (lot.ownerAgentId === 0n) continue;
      const eff = lot.valueDivisor === 0n ? lot.revealedValue : lot.revealedValue / lot.valueDivisor;
      const profit = BigInt(eff) - BigInt(lot.paidPrice);
      if (lot.coalitionPartner === 0n) {
        m.set(lot.ownerAgentId.toString(), (m.get(lot.ownerAgentId.toString()) ?? 0n) + profit);
      } else {
        const half = profit / 2n;
        m.set(lot.ownerAgentId.toString(), (m.get(lot.ownerAgentId.toString()) ?? 0n) + (profit - half));
        m.set(lot.coalitionPartner.toString(), (m.get(lot.coalitionPartner.toString()) ?? 0n) + half);
      }
    }
    return m;
  }, [lots]);

  // Settlement: once Finalized, the winner is the computed top-P&L agent (never
  // hardcoded). Drives the banner + the victory sigil on the winning panel.
  const settled = snapshot?.phase === 4;
  const winner = useMemo(() => {
    if (!settled) return null;
    let bestId: string | null = null;
    let best: bigint | null = null;
    for (const [id, v] of scoreByAgent) {
      if (best === null || v > best) { best = v; bestId = id; }
    }
    if (bestId === null) return null;
    return { id: BigInt(bestId), score: best ?? 0n, agent: agentById.get(bestId) };
  }, [settled, scoreByAgent, agentById]);

  if (!matchId) {
    return <div className="p-8 text-text-secondary">scanning for the latest match…</div>;
  }
  if (!snapshot) {
    return <div className="p-8 text-text-secondary">loading match #{matchId.toString()}…</div>;
  }

  const phaseLabel = MATCH_PHASE[snapshot.phase] ?? "Unknown";
  const isLive = snapshot.phase === 1 || snapshot.phase === 2 || snapshot.phase === 3;
  const auditClean = !audit || audit.verdictsSuspect === 0;
  const winnerName = winner?.agent?.name ?? (winner ? `Agent #${winner.id}` : "");

  return (
    <div className="p-4 flex flex-col h-full gap-3">
      {/* Match header bar */}
      <div className="panel-raised flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-4 label-sm">
          <span className="font-display text-lg text-text-primary">Match #{matchId.toString()}</span>
          <span>round <span className="text-text-primary font-mono">{snapshot.currentRound}/{snapshot.rounds}</span></span>
          <span>turn <span className="text-text-primary font-mono">{snapshot.currentTurnIdx + 1}/{snapshot.agentIds.length}</span></span>
          <span>{snapshot.kind === 1 ? "RealStakes" : "Exhibition"}</span>
          <span className={isLive ? "text-accent" : settled ? "text-value-up" : "text-text-dim"}>
            {isLive && <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-live-dot mr-1.5" />}
            {settled ? "✓ Final" : phaseLabel}
          </span>
        </div>
        {audit && audit.status !== 0 && (
          <div className="label-sm">
            audit <span className={audit.verdictsSuspect > 0 ? "text-value-down" : "text-accent"}>{AUDIT_STATUS[audit.status]}</span>
            {" · "}clean {audit.verdictsClean} / suspect {audit.verdictsSuspect}
          </div>
        )}
      </div>

      {/* Settlement banner — the climax beat: winner crowned, payout released */}
      {settled && winner && (
        <div
          className="flex items-center gap-4 px-5 py-3.5 rounded-md animate-settle-in"
          style={{
            background:
              "linear-gradient(90deg, color-mix(in srgb, #F5A623 12%, #1C1F24), #1C1F24 60%)",
            border: "1px solid #F5A623",
            boxShadow: "0 0 0 1px rgba(245,166,35,.25), 0 10px 36px -16px rgba(245,166,35,.6)",
          }}
        >
          <SigilTile name={winnerName} size={40} state="victory" ring />
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <span className="label-xs">
              settlement complete · payout released · audit {auditClean ? "clean" : "suspect"}
            </span>
            <span className="font-display text-lg">
              <span style={{ color: personaColorOf(winnerName) }}>{winnerName}</span> takes the pot
            </span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="label-xs">net P&amp;L</span>
            <CountUp
              to={Number(winner.score)}
              prefix={Number(winner.score) > 0 ? "+" : ""}
              className={`font-mono text-[22px] font-bold ${Number(winner.score) < 0 ? "text-value-down" : "text-value-up"}`}
            />
          </div>
        </div>
      )}

      {/* Four-region grid */}
      <div className="grid grid-cols-[260px_1fr_300px] gap-3 flex-1 min-h-0">
        {/* Left — agents */}
        <div className="flex flex-col gap-2 min-h-0 overflow-y-auto">
          {snapshot.agentIds.map((id, idx) => {
            const a = agentById.get(id.toString());
            const active = idx === snapshot.currentTurnIdx && isLive;
            const isWinner = settled && winner?.id === id;
            const state = active
              ? "thinking"
              : isWinner
              ? "victory"
              : moves.some((m) => m.agentId === id && m.kind === "COALITION")
              ? "coalition"
              : "idle";
            return (
              <AgentPanel
                key={id.toString()}
                agent={a ?? { id, name: `Agent #${id}` }}
                budget={snapshot.budgets[idx]}
                score={scoreByAgent.get(id.toString())}
                active={active || isWinner}
                state={state}
              />
            );
          })}
        </div>

        {/* Center — negotiation stream */}
        <NegotiationStream moves={moves} agentById={agentById} />

        {/* Right — lots + season fund */}
        <aside className="flex flex-col gap-2 min-h-0 overflow-y-auto">
          {lots.map((l, i) => (
            <LotCard
              key={i}
              lot={l}
              index={i}
              agentNameById={(id) => agentById.get(id.toString())?.name ?? `#${id}`}
            />
          ))}
        </aside>
      </div>

      {/* Bottom — move log strip (subset, expandable in transcript above) */}
      <div className="panel px-3 py-2 text-xs font-mono text-text-secondary flex items-center gap-4">
        <span>moves <span className="text-text-primary">{moves.length}</span></span>
        <span>OFFER <span className="text-text-primary">{moves.filter((m) => m.kind === "OFFER").length}</span></span>
        <span>COUNTER <span className="text-text-primary">{moves.filter((m) => m.kind === "COUNTER").length}</span></span>
        <span>COALITION <span className="text-text-primary">{moves.filter((m) => m.kind === "COALITION").length}</span></span>
        <span>PASS <span className="text-text-primary">{moves.filter((m) => m.kind === "PASS").length}</span></span>
        <span>REJECTED <span className="text-status-timeout">{moves.filter((m) => m.kind === "REJECTED").length}</span></span>
        <span>DEFAULTED <span className="text-status-timeout">{moves.filter((m) => m.kind === "DEFAULTED").length}</span></span>
      </div>
    </div>
  );
}

async function fetchMatchAndLots(matchId: bigint) {
  const snap = await fetchMatch(matchId);
  return await fetchAllLots(matchId, snap.numLots);
}
