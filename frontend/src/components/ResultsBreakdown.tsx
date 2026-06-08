import { useState } from "react";
import { sttScale } from "../lib/format";
import { personaColorOf } from "../sigils/personas";

/** One item an agent won, with the margin that fed their score. */
export interface WonLot {
  category: string;
  paid: bigint;
  value: bigint;
  profit: bigint;
  /** Name of the coalition partner this item was split with, if any. */
  coalitionWith?: string;
}

/** Per-agent settlement result, pre-ranked by net profit (highest first). */
export interface AgentResult {
  id: bigint;
  name: string;
  score: bigint;
  lots: WonLot[];
}

/** Format a signed scaled value as a compact "+N" / "−N" STT string. */
function signed(v: bigint): string {
  const n = sttScale(v);
  const body = Number.isInteger(n) ? n.toString() : n.toFixed(2);
  return n > 0 ? `+${body}` : body;
}

function magnitude(v: bigint): string {
  const n = sttScale(v);
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
}

/**
 * Settlement explainer: ranks every agent by net profit and shows the exact
 * items that earned it. The winner won because they banked the most total
 * margin — "what each item was really worth, minus what they paid". This makes
 * the crowned winner legible instead of an unexplained verdict.
 */
export function ResultsBreakdown({ results, winnerId }: {
  results: AgentResult[];
  winnerId: bigint | null;
}) {
  const [expanded, setExpanded] = useState(false);

  if (results.length === 0) return null;

  return (
    <div className="panel p-3 animate-settle-in">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={`w-full flex items-baseline justify-between gap-2 text-left ${expanded ? "mb-2" : ""}`}
      >
        <span className="flex items-baseline gap-1.5">
          <span
            className={`font-mono text-text-dim text-xs transition-transform ${expanded ? "rotate-90" : ""}`}
            aria-hidden
          >
            ▸
          </span>
          <span className="font-display text-sm text-text-primary">How the match was won</span>
        </span>
        <span
          className="label-xs normal-case tracking-normal text-text-dim"
          title="Each agent's score is the profit it banked: for every item it won, the item's true value minus the price it paid. Highest total wins."
        >
          {expanded ? "score = what items were worth − what was paid" : "tap to see results"}
        </span>
      </button>

      {expanded && (
      <ol className="flex flex-col gap-1.5">
        {results.map((r, rank) => {
          const isWinner = winnerId !== null && r.id === winnerId;
          const color = personaColorOf(r.name);
          return (
            <li
              key={r.id.toString()}
              className={`rounded-md px-2.5 py-2 ${isWinner ? "bg-value-up/5 ring-1 ring-value-up/40" : "bg-bg-panel-raised/40"}`}
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs text-text-dim w-4 tabular-nums">{rank + 1}</span>
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ background: color }}
                  aria-hidden
                />
                <span className="font-display text-sm" style={{ color: isWinner ? color : undefined }}>
                  {r.name}
                </span>
                {isWinner && (
                  <span className="label-xs text-value-up border border-value-up/40 rounded-sm px-1 py-0.5">
                    winner
                  </span>
                )}
                <span className="flex-1" />
                <span
                  className={`font-mono text-sm font-bold ${r.score < 0n ? "text-value-down" : r.score > 0n ? "text-value-up" : "text-text-dim"}`}
                >
                  {signed(r.score)} STT
                </span>
              </div>

              {r.lots.length > 0 ? (
                <div className="mt-1.5 pl-9 flex flex-col gap-0.5">
                  {r.lots.map((lot, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs font-mono text-text-secondary">
                      <span className="text-text-primary truncate max-w-[40%]">{lot.category}</span>
                      <span className="text-text-dim">
                        worth {magnitude(lot.value)} − paid {magnitude(lot.paid)}
                      </span>
                      {lot.coalitionWith && (
                        <span className="text-accent">· split w/ {lot.coalitionWith}</span>
                      )}
                      <span className="flex-1" />
                      <span className={lot.profit < 0n ? "text-value-down" : "text-value-up"}>
                        {signed(lot.profit)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-1 pl-9 text-xs text-text-dim">won no items</div>
              )}
            </li>
          );
        })}
      </ol>
      )}
    </div>
  );
}
