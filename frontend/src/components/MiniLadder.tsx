import { useEffect, useState } from "react";
import { fetchAllAgents } from "../chain/reads";
import type { Agent } from "../chain/types";
import { SigilTile } from "./SigilTile";

export function MiniLadder({ limit = 5 }: { limit?: number }) {
  const [agents, setAgents] = useState<Agent[] | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const all = await fetchAllAgents();
      if (!cancel) setAgents(all);
    })();
    const id = setInterval(async () => {
      const all = await fetchAllAgents();
      if (!cancel) setAgents(all);
    }, 20000);
    return () => { cancel = true; clearInterval(id); };
  }, []);

  if (!agents) return <div className="label-sm">loading leaderboard…</div>;
  const ranked = [...agents].sort((a, b) => b.elo - a.elo).slice(0, limit);

  return (
    <ol className="space-y-1.5">
      {ranked.map((a, i) => (
        <li
          key={a.id.toString()}
          className="flex items-center gap-3 px-2 py-1.5 rounded-sm bg-bg-panel border border-border-subtle"
        >
          <span className="font-mono w-5 text-right text-text-dim">{i + 1}</span>
          <SigilTile name={a.name} size={28} />
          <span className="flex-1 truncate font-display">{a.name}</span>
          <span className="font-mono text-text-secondary">{a.elo}</span>
        </li>
      ))}
    </ol>
  );
}
