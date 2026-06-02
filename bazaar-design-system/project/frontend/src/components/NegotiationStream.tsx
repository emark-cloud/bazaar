import { useState } from "react";
import type { Agent, MoveEntry } from "../chain/types";
import { TraceWaterfall } from "./TraceWaterfall";
import { PERSONA_COLOR, generatedColorFor, nameToPersona } from "../sigils/personas";

type View = "transcript" | "orderbook";

export function NegotiationStream({
  moves,
  agentById,
}: {
  moves: MoveEntry[];
  agentById: Map<string, Agent>;
}) {
  const [view, setView] = useState<View>("transcript");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggleExpand(i: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <section className="panel h-full flex flex-col">
      <header className="flex items-center justify-between px-4 py-2 border-b border-border-subtle">
        <h3 className="font-display text-lg">Negotiation</h3>
        <div className="inline-flex border border-border-subtle rounded-sm overflow-hidden text-xs font-mono">
          <button
            onClick={() => setView("transcript")}
            className={`px-3 py-1 ${view === "transcript" ? "bg-bg-panel-raised text-accent" : "text-text-secondary hover:text-text-primary"}`}
          >transcript</button>
          <button
            onClick={() => setView("orderbook")}
            className={`px-3 py-1 ${view === "orderbook" ? "bg-bg-panel-raised text-accent" : "text-text-secondary hover:text-text-primary"}`}
          >order book</button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {moves.length === 0 && (
          <div className="text-center text-text-dim py-8 label-sm">
            waiting for the first move to land…
          </div>
        )}
        {view === "transcript" && moves.map((m, i) => (
          <TranscriptLine
            key={`${m.round}-${m.turnIdx}-${i}`}
            move={m}
            agent={agentById.get(m.agentId.toString())}
            expanded={expanded.has(i)}
            onClick={() => toggleExpand(i)}
          />
        ))}
        {view === "orderbook" && (
          <div className="font-mono text-xs">
            <div className="grid grid-cols-[40px_1fr_120px_60px_80px] text-text-dim uppercase tracking-wider px-2 py-1 border-b border-border-subtle">
              <span>r·t</span><span>agent</span><span>action</span><span>lot</span><span>price</span>
            </div>
            {moves.map((m, i) => {
              const parts = parseMove(m.raw);
              const isReject = m.kind === "REJECTED" || m.kind === "DEFAULTED";
              return (
                <div key={i}>
                  <div
                    onClick={() => toggleExpand(i)}
                    className={`grid grid-cols-[40px_1fr_120px_60px_80px] px-2 py-1 cursor-pointer hover:bg-bg-panel-raised border-b border-border-subtle/50 ${isReject ? "text-status-timeout" : ""}`}
                  >
                    <span>{m.round}·{m.turnIdx}</span>
                    <span>{agentById.get(m.agentId.toString())?.name ?? `#${m.agentId}`}</span>
                    <span>{m.kind}</span>
                    <span>{parts.lot ?? "—"}</span>
                    <span>{parts.price ?? (m.reason ? "✗" : "—")}</span>
                  </div>
                  {expanded.has(i) && <TraceWaterfall move={m} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function TranscriptLine({
  move, agent, expanded, onClick,
}: { move: MoveEntry; agent?: Agent; expanded: boolean; onClick: () => void }) {
  const name = agent?.name ?? `Agent #${move.agentId}`;
  const persona = agent ? nameToPersona(agent.name) : "generic";
  const color = persona === "generic" ? generatedColorFor(name) : PERSONA_COLOR[persona];
  const parts = parseMove(move.raw);

  let phrase = move.raw;
  if (move.kind === "OFFER")     phrase = `offers ${parts.price ?? "?"} STT for lot ${parts.lot ?? "?"}`;
  if (move.kind === "COUNTER")   phrase = `counters at ${parts.price ?? "?"} on lot ${parts.lot ?? "?"}`;
  if (move.kind === "COALITION") phrase = `proposes coalition with agent ${parts.partner ?? "?"} (share ${parts.share ?? "50"})`;
  if (move.kind === "PASS")      phrase = `passes`;
  if (move.kind === "REJECTED")  phrase = `move rejected — ${move.reason ?? "reason"}`;
  if (move.kind === "DEFAULTED") phrase = `defaulted — ${move.reason ?? "request failed"}`;

  const tag = move.kind;
  const isFail = move.kind === "REJECTED" || move.kind === "DEFAULTED";

  return (
    <div className="animate-slide-up-in">
      <div
        onClick={onClick}
        className="flex items-start gap-3 px-2 py-1.5 rounded-sm hover:bg-bg-panel-raised cursor-pointer"
      >
        <span className="font-mono text-text-dim w-12 shrink-0">r{move.round}·t{move.turnIdx}</span>
        <span
          className="inline-block w-1 self-stretch rounded-sm"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-display" style={{ color }}>{name}</span>
            <span className={`text-text-secondary text-sm ${isFail ? "text-status-timeout" : ""}`}>{phrase}</span>
          </div>
          <div className="label-xs mt-0.5">
            {tag} {move.requestId !== undefined && <>· req <span className="text-text-secondary">{shortId(move.requestId)}</span></>}
          </div>
        </div>
        <span className="label-xs">{expanded ? "▾" : "▸"}</span>
      </div>
      {expanded && <TraceWaterfall move={move} />}
    </div>
  );
}

function shortId(id: bigint): string {
  const s = id.toString();
  if (s.length <= 8) return s;
  return s.slice(0, 6) + "…";
}

/** Parse a raw move string into its named parts. */
function parseMove(raw: string): { lot?: string; price?: string; partner?: string; share?: string } {
  const out: Record<string, string> = {};
  for (const tok of raw.split("|")) {
    const m = tok.match(/^(lot|price|partner|share)=(.+)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}
