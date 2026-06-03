import { useEffect, useRef, useState } from "react";
import type { Agent, MoveEntry } from "../chain/types";
import { TraceWaterfall } from "./TraceWaterfall";
import { personaColorOf } from "../sigils/personas";
import { RECEIPT_BASE } from "../chain/config";

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
  const bodyRef = useRef<HTMLDivElement>(null);

  // Feed scrolls to the latest row as moves land — terminal rhythm. Never
  // scrollIntoView (it would yank the whole page); set scrollTop directly.
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [moves.length, view]);

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
          >play-by-play</button>
          <button
            onClick={() => setView("orderbook")}
            className={`px-3 py-1 ${view === "orderbook" ? "bg-bg-panel-raised text-accent" : "text-text-secondary hover:text-text-primary"}`}
          >bid table</button>
        </div>
      </header>
      <div ref={bodyRef} className="flex-1 overflow-y-auto p-3 space-y-1.5">
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
            isLatest={i === moves.length - 1}
          />
        ))}
        {view === "orderbook" && (
          <div className="font-mono text-xs">
            <div className="grid grid-cols-[40px_1fr_120px_60px_80px] text-text-dim uppercase tracking-wider px-2 py-1 border-b border-border-subtle">
              <span>r·t</span><span>agent</span><span>action</span><span>item</span><span>price</span>
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
  move, agent, expanded, onClick, isLatest,
}: { move: MoveEntry; agent?: Agent; expanded: boolean; onClick: () => void; isLatest?: boolean }) {
  const name = agent?.name ?? `Agent #${move.agentId}`;
  const color = personaColorOf(name);
  const parts = parseMove(move.raw);

  let phrase = move.raw;
  if (move.kind === "OFFER")     phrase = `offers ${parts.price ?? "?"} STT for item ${parts.lot ?? "?"}`;
  if (move.kind === "COUNTER")   phrase = `counters at ${parts.price ?? "?"} on item ${parts.lot ?? "?"}`;
  if (move.kind === "COALITION") phrase = `proposes a team-up with agent ${parts.partner ?? "?"} (split ${parts.share ?? "50"}/${100 - Number(parts.share ?? "50")})`;
  if (move.kind === "PASS")      phrase = `passes`;
  if (move.kind === "REJECTED")  phrase = `move rejected — ${move.reason ?? "reason"}`;
  if (move.kind === "DEFAULTED") phrase = `move failed — ${move.reason ?? "request failed"}`;

  const isFail = move.kind === "REJECTED" || move.kind === "DEFAULTED";

  // The newest row lands with a persona-tinted highlight (~9% of --p) + a glow
  // on its rule. `${color}17` is hex-alpha ≈ 9%.
  const rowStyle = isLatest ? { backgroundColor: `${color}17` } : undefined;
  const ruleStyle = isLatest
    ? { backgroundColor: color, boxShadow: `0 0 10px -1px ${color}` }
    : { backgroundColor: color };

  return (
    <div className="animate-slide-up-in">
      <div
        onClick={onClick}
        className="flex items-start gap-3 px-2 py-1.5 rounded-sm hover:bg-bg-panel-raised cursor-pointer transition-colors"
        style={rowStyle}
      >
        <span className="font-mono text-text-dim w-12 shrink-0 pt-0.5 text-[11px]">r{move.round}·t{move.turnIdx}</span>
        <span className="inline-block w-[3px] self-stretch rounded-sm shrink-0" style={ruleStyle} aria-hidden />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-display truncate" style={{ color }}>{name}</span>
            <span
              className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm shrink-0 bg-bg-base border ${
                isFail
                  ? "text-status-timeout border-status-timeout/50"
                  : "text-text-secondary border-border-strong"
              }`}
            >
              {move.kind}
            </span>
          </div>
          <span className={`block text-[13px] ${isFail ? "text-status-timeout" : "text-text-secondary"}`}>{phrase}</span>
          {move.requestId !== undefined && (
            move.kind === "DEFAULTED" ? (
              <span className="inline-flex items-center gap-1 mt-1 font-mono text-[10px] px-1.5 py-0.5 rounded-sm border border-status-timeout/40 text-status-timeout">
                <span aria-hidden>⛓</span> on the network · move failed
                <span className="text-text-dim">· req {shortId(move.requestId)}</span>
              </span>
            ) : (
              <span className="inline-flex flex-wrap items-center gap-1.5 mt-1">
                <span
                  className="inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded-sm border border-value-up/40 text-value-up"
                  title="This move was decided by AI and confirmed by a 3-of-3 vote of the network's validators — so no one can fake it."
                >
                  <span aria-hidden>⛓</span> verified&nbsp;✓ · 3 validators
                </span>
                {/* The agent's actual reasoning lives in Somnia's off-chain receipt
                    (it can't be embedded — the receipt page blocks framing/CORS — so
                    we link straight to it). One click from the move to the why. */}
                <a
                  href={`${RECEIPT_BASE}/${move.requestId}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded-sm border border-accent/50 text-accent hover:bg-accent hover:text-bg-base transition-colors"
                  title="See the agent's full reasoning — the LLM's step-by-step trace that produced this move (opens Somnia's receipt)."
                >
                  <span aria-hidden>🧠</span> see reasoning ↗
                </a>
              </span>
            )
          )}
        </div>
        <span className="label-xs pt-0.5 shrink-0">{expanded ? "▾" : "▸"}</span>
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
