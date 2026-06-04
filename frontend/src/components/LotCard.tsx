import { useCountUp, usePrefersReducedMotion } from "../lib/motion";
import { formatBudget } from "../lib/format";

/** Pull a compact source label out of a feed URL, e.g. "api.coinbase.com". */
function sourceLabel(feedUrl: string): string {
  try {
    return new URL(feedUrl).host;
  } catch {
    return feedUrl.slice(0, 28);
  }
}

export function LotCard({ lot, index, agentNameById }: {
  lot: {
    category: string;
    feedUrl: string;
    valueHint: string;
    revealed: boolean;
    revealedValue: bigint;
    ownerAgentId: bigint;
    paidPrice: bigint;
    standingOfferPrice: bigint;
    standingOfferBy: bigint;
    coalitionPartner: bigint;
  };
  index: number;
  agentNameById: (id: bigint) => string;
}) {
  const sold = lot.ownerAgentId !== 0n;
  const standing = !sold && lot.standingOfferPrice !== 0n;

  const reduced = usePrefersReducedMotion();
  // Counts 0 → value once the lot reveals. Instant under reduced motion.
  const counted = useCountUp(lot.revealedValue, lot.revealed);
  // Lots reveal in sequence, not at once (design.md §4) — stagger by lot index.
  const revealStyle = reduced ? undefined : { animationDelay: `${index * 140}ms` };

  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-text-dim text-xs">item {index + 1}</span>
          <span className="font-display">{lot.category}</span>
        </div>
        <span className="label-xs">{lot.valueHint}</span>
      </div>
      <div className="mt-2 flex items-center justify-between [perspective:600px]">
        <span className="label-sm" title="The item's true value, hidden until the match ends — pulled from live real-world data.">true value</span>
        <span className="font-mono">
          {lot.revealed ? (
            <span
              className={`inline-block text-value-up origin-bottom ${reduced ? "" : "animate-lot-flip"}`}
              style={revealStyle}
            >
              {counted.toString()}
            </span>
          ) : (
            <span className="text-text-dim">⌛ hidden</span>
          )}
        </span>
      </div>
      {lot.revealed && (
        <div
          className={`mt-1 flex items-center justify-between ${reduced ? "" : "animate-fade-in"}`}
          style={revealStyle}
        >
          <span className="label-xs">source</span>
          <a
            href={lot.feedUrl}
            target="_blank"
            rel="noreferrer"
            className="label-xs text-text-secondary hover:text-accent truncate max-w-[60%]"
            title={lot.feedUrl}
          >
            {sourceLabel(lot.feedUrl)}
          </a>
        </div>
      )}
      <div className="mt-1 flex items-center justify-between text-sm">
        {sold ? (
          <>
            <span className="label-sm">sold to</span>
            <span className="font-mono">
              {agentNameById(lot.ownerAgentId)} @ {formatBudget(lot.paidPrice)} STT
              {lot.coalitionPartner !== 0n && (
                <span className="text-accent"> +{agentNameById(lot.coalitionPartner)}</span>
              )}
            </span>
          </>
        ) : standing ? (
          <>
            <span className="label-sm">top bid</span>
            <span className="font-mono text-text-secondary">
              {formatBudget(lot.standingOfferPrice)} STT ← {agentNameById(lot.standingOfferBy)}
            </span>
          </>
        ) : (
          <span className="label-sm text-text-dim">no bids yet</span>
        )}
      </div>
    </div>
  );
}
