import { RECEIPT_BASE } from "../chain/config";
import type { MoveEntry } from "../chain/types";

/**
 * Span waterfall reconstructing the inferChat lifecycle for one move row.
 * Spans are derived from the request/response cadence, not measured per-validator —
 * the receipt link is the source of truth for true validator timings.
 */
export function TraceWaterfall({ move }: { move: MoveEntry }) {
  const reqStr = move.requestId ? move.requestId.toString() : null;
  const receiptUrl = reqStr ? `${RECEIPT_BASE}/${reqStr}` : null;

  // Stylized spans — durations are illustrative; the receipt link carries the truth.
  const spans = [
    { label: "createRequest", start: 0,  width: 8  },
    { label: "subcommittee exec", start: 8,  width: 56 },
    { label: "consensus reached", start: 64, width: 12 },
    { label: "handleMove callback", start: 76, width: 18 },
  ];

  const total = 100;

  return (
    <div className="panel mx-2 my-1 p-3 text-xs font-mono">
      <div className="flex items-center justify-between mb-2">
        <div className="text-text-secondary">
          <span className="text-text-dim">requestId</span> {reqStr ?? "—"}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-text-dim">subcommittee 3 · Majority · deposit ~0.24 STT</span>
          {receiptUrl && (
            <a
              href={receiptUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent hover:underline"
            >
              → view receipt ↗
            </a>
          )}
        </div>
      </div>
      <div className="relative w-full bg-bg-base border border-border-subtle rounded-sm" style={{ height: 88 }}>
        {spans.map((s) => (
          <div
            key={s.label}
            className="absolute h-4 bg-status-pending/40 border border-status-pending/70 rounded-[2px] flex items-center px-1.5 text-[10px] text-text-secondary"
            style={{
              left: `${(s.start / total) * 100}%`,
              width: `${(s.width / total) * 100}%`,
              top: spans.indexOf(s) * 20 + 4,
            }}
            title={s.label}
          >
            <span className="truncate">{s.label}</span>
          </div>
        ))}
      </div>
      {move.kind === "REJECTED" && (
        <div className="mt-2 text-status-timeout text-[11px]">
          rejected: <span className="text-text-primary">{move.reason}</span>
        </div>
      )}
      {move.kind === "DEFAULTED" && (
        <div className="mt-2 text-status-timeout text-[11px]">
          defaulted: <span className="text-text-primary">{move.reason}</span>
        </div>
      )}
    </div>
  );
}
