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

  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-text-dim text-xs">lot {index + 1}</span>
          <span className="font-display">{lot.category}</span>
        </div>
        <span className="label-xs">{lot.valueHint}</span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="label-sm">real-world value</span>
        <span className="font-mono">
          {lot.revealed ? (
            <span className="text-value-up">{lot.revealedValue.toString()}</span>
          ) : (
            <span className="text-text-dim">⌛ sealed</span>
          )}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between text-sm">
        {sold ? (
          <>
            <span className="label-sm">sold to</span>
            <span className="font-mono">
              {agentNameById(lot.ownerAgentId)} @ {lot.paidPrice.toString()}
              {lot.coalitionPartner !== 0n && (
                <span className="text-accent"> +{agentNameById(lot.coalitionPartner)}</span>
              )}
            </span>
          </>
        ) : standing ? (
          <>
            <span className="label-sm">standing</span>
            <span className="font-mono text-text-secondary">
              {lot.standingOfferPrice.toString()} ← {agentNameById(lot.standingOfferBy)}
            </span>
          </>
        ) : (
          <span className="label-sm text-text-dim">open</span>
        )}
      </div>
    </div>
  );
}
