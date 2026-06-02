import { useEffect, useMemo, useState } from "react";
import type { Agent, MoveEntry } from "../chain/types";
import { fetchMatch, fetchAllLots, fetchAllAgents } from "../chain/reads";
import { fetchMatchEvents, eventsToMoves } from "../chain/events";
import { SigilTile } from "./SigilTile";
import { personaColorOf, nameToPersona, PERSONA_LABEL } from "../sigils/personas";
import { formatBudget } from "../lib/format";

interface PreviewState {
  agentIds: readonly bigint[];
  budgets: readonly bigint[];
  currentTurnIdx: number;
  rounds: number;
  currentRound: number;
  phase: number;
  lots: { ownerAgentId: bigint; category: string }[];
}

/**
 * The living hero. A real mini-match board: the four competitors with sigils +
 * budgets, a negotiation ticker (last 3 moves, newest opaque), and a row of lot
 * pips. Driven by the SAME on-chain reads the live match uses — polled, not a
 * fake demo interval. Renders nothing if no match is resolvable.
 */
export function LiveMatchPreview({ matchId, onEnter }: { matchId: bigint; onEnter: () => void }) {
  const [state, setState] = useState<PreviewState | null>(null);
  const [moves, setMoves] = useState<MoveEntry[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);

  // Snapshot + lots + agents (slower-changing) — poll alongside the live match's cadence.
  useEffect(() => {
    let cancel = false;
    async function tick() {
      try {
        const [snap, allAgents] = await Promise.all([fetchMatch(matchId), fetchAllAgents()]);
        const lots = await fetchAllLots(matchId, snap.numLots);
        if (cancel) return;
        setAgents(allAgents);
        setState({
          agentIds: snap.agentIds,
          budgets: snap.budgets,
          currentTurnIdx: snap.currentTurnIdx,
          rounds: snap.rounds,
          currentRound: snap.currentRound,
          phase: snap.phase,
          lots: lots.map((l: any) => ({ ownerAgentId: l.ownerAgentId, category: l.category })),
        });
      } catch { /* keep last good state */ }
    }
    tick();
    const id = setInterval(tick, 8000);
    return () => { cancel = true; clearInterval(id); };
  }, [matchId]);

  // Move log — same event read the live transcript uses; streams in as moves land.
  useEffect(() => {
    let cancel = false;
    async function tick() {
      try {
        const evs = await fetchMatchEvents(matchId);
        if (!cancel) setMoves(eventsToMoves(evs));
      } catch { /* keep last good state */ }
    }
    tick();
    const id = setInterval(tick, 8000);
    return () => { cancel = true; clearInterval(id); };
  }, [matchId]);

  const agentById = useMemo(() => {
    const m = new Map<string, Agent>();
    for (const a of agents) m.set(a.id.toString(), a);
    return m;
  }, [agents]);

  const isLive = state ? state.phase === 1 || state.phase === 2 || state.phase === 3 : false;
  const activeId =
    state && isLive ? state.agentIds[state.currentTurnIdx] : undefined;
  const ticker = moves.slice(-3).reverse();

  if (!state) {
    return (
      <div className="relative mt-5 panel-raised p-6 text-center label-sm text-text-dim">
        loading the live board…
      </div>
    );
  }

  return (
    <div className="relative mt-5 grid grid-cols-2 gap-3">
      {/* Agent board — 2×2, persona top-border, active card highlighted */}
      <div className="grid grid-cols-2 gap-2 content-start">
        {state.agentIds.map((id, idx) => {
          const a = agentById.get(id.toString());
          const name = a?.name ?? `Agent #${id}`;
          const persona = nameToPersona(name);
          const personaLabel = persona === "generic" ? null : PERSONA_LABEL[persona];
          const active = id === activeId;
          return (
            <div
              key={id.toString()}
              className={`flex items-center gap-2.5 p-2.5 rounded-md bg-bg-panel-raised border min-w-0 transition-colors ${
                active ? "border-border-strong" : "border-border-subtle"
              }`}
              style={{ borderTop: `2px solid ${personaColorOf(name)}` }}
            >
              <SigilTile name={name} size={40} state={active ? "thinking" : "idle"} ring={active} />
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="font-display text-[13px] truncate">{name}</span>
                {personaLabel && (
                  <span className="label-xs leading-none" style={{ color: personaColorOf(name) }}>{personaLabel}</span>
                )}
                <span className="font-mono text-xs text-text-primary">
                  {formatBudget(state.budgets[idx])}
                  <span className="text-text-dim"> STT</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live negotiation ticker — newest fully opaque, older faded */}
      <div
        onClick={onEnter}
        title="Enter the live match"
        className="row-span-2 flex flex-col gap-2 p-3 rounded-md bg-bg-base border border-border-subtle cursor-pointer hover:border-border-strong transition-colors"
      >
        <div className="flex items-center justify-between label-xs">
          <span className="flex items-center gap-2 text-accent">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-live-dot" />
            negotiation · {isLive ? "live" : "replay"}
          </span>
          <span className="text-text-dim">round {state.currentRound}/{state.rounds}</span>
        </div>
        <div className="flex flex-col gap-2">
          {ticker.length === 0 && (
            <div className="label-sm text-text-dim py-2">waiting for the first move…</div>
          )}
          {ticker.map((m, i) => (
            <TickerLine
              key={`${m.round}-${m.turnIdx}-${i}`}
              move={m}
              name={agentById.get(m.agentId.toString())?.name ?? `Agent #${m.agentId}`}
              opacity={i === 0 ? 1 : i === 1 ? 0.62 : 0.34}
            />
          ))}
        </div>
        <div className="mt-auto pt-2 label-xs text-text-dim border-t border-border-subtle/60">
          ⛓ each move is a consensus-verified on-chain LLM call
        </div>
      </div>

      {/* Lot pips */}
      <div className="grid grid-cols-2 gap-2">
        {state.lots.map((l, i) => {
          const sold = l.ownerAgentId !== 0n;
          return (
            <div
              key={i}
              className="flex items-center justify-between gap-2 px-2.5 py-2 rounded bg-bg-panel border border-border-subtle"
              title={l.category}
            >
              <span className="label-xs text-text-secondary truncate">{l.category || `lot ${i + 1}`}</span>
              <span className={`font-mono text-[11px] whitespace-nowrap ${sold ? "text-value-up" : "text-text-dim"}`}>
                {sold ? "✓ sold" : "⌛ sealed"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TickerLine({ move, name, opacity }: { move: MoveEntry; name: string; opacity: number }) {
  const color = personaColorOf(name);
  const parts = parseTicker(move.raw);
  let phrase: string = move.kind.toLowerCase();
  if (move.kind === "OFFER")     phrase = `offers ${parts.price ?? "?"} STT · lot ${parts.lot ?? "?"}`;
  if (move.kind === "COUNTER")   phrase = `counters ${parts.price ?? "?"} · lot ${parts.lot ?? "?"}`;
  if (move.kind === "COALITION") phrase = `coalition w/ agent ${parts.partner ?? "?"}`;
  if (move.kind === "PASS")      phrase = "passes";
  if (move.kind === "REJECTED")  phrase = "rejected";
  if (move.kind === "DEFAULTED") phrase = "defaulted";
  const fail = move.kind === "REJECTED" || move.kind === "DEFAULTED";

  return (
    <div className="grid grid-cols-[3px_auto_1fr_auto] items-center gap-2" style={{ opacity }}>
      <span className="h-4 w-[3px] rounded-sm" style={{ backgroundColor: color }} aria-hidden />
      <span className="font-display text-[13px] truncate" style={{ color }}>{name.replace(/-.*$/, "")}</span>
      <span className={`font-mono text-xs truncate ${fail ? "text-status-timeout" : "text-text-secondary"}`}>{phrase}</span>
      <span className="label-xs">{move.kind}</span>
    </div>
  );
}

function parseTicker(raw: string): { lot?: string; price?: string; partner?: string } {
  const out: Record<string, string> = {};
  for (const tok of (raw || "").split("|")) {
    const m = tok.match(/^(lot|price|partner|share)=(.+)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}
