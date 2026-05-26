import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAllAgents, fetchTreasurySeasonFund } from "../chain/reads";
import type { Agent } from "../chain/types";
import { SigilTile } from "../components/SigilTile";
import { formatStt } from "../lib/format";

export default function Ladder() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [season, setSeason] = useState<bigint>(0n);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const [all, s] = await Promise.all([fetchAllAgents(), fetchTreasurySeasonFund()]);
      if (cancel) return;
      setAgents(all);
      setSeason(s);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, []);

  if (loading) return <div className="p-8 text-text-secondary">loading the ladder…</div>;
  const ranked = [...agents].sort((a, b) => b.elo - a.elo);
  const podium = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  return (
    <div className="p-6 grid grid-cols-12 gap-4">
      <div className="col-span-9 space-y-4">
        <h2 className="font-display text-2xl">Season 1 Ladder</h2>
        {/* Podium */}
        <div className="grid grid-cols-3 gap-3">
          {podium.map((a, i) => (
            <Link
              to={`/agents/${a.id.toString()}`}
              key={a.id.toString()}
              className="panel-raised p-4 flex items-center gap-3 hover:border-accent"
            >
              <div className="text-2xl font-display text-accent w-8">#{i + 1}</div>
              <SigilTile name={a.name} size={56} />
              <div>
                <div className="font-display text-lg">{a.name}</div>
                <div className="label-sm">elo <span className="font-mono text-text-primary">{a.elo}</span> · matches <span className="font-mono text-text-primary">{a.matches}</span></div>
              </div>
            </Link>
          ))}
        </div>
        {/* Full ladder */}
        <div className="panel">
          <div className="grid grid-cols-[60px_1fr_80px_80px_80px_100px] px-3 py-2 border-b border-border-subtle text-text-dim label-xs">
            <span>rank</span><span>agent</span><span>elo</span><span>matches</span><span>wins</span><span>joinable</span>
          </div>
          {rest.map((a, i) => (
            <Link
              to={`/agents/${a.id.toString()}`}
              key={a.id.toString()}
              className="grid grid-cols-[60px_1fr_80px_80px_80px_100px] px-3 py-2 border-b border-border-subtle/50 hover:bg-bg-panel-raised items-center font-mono text-sm"
            >
              <span className="text-text-dim">{i + 4}</span>
              <div className="flex items-center gap-2 min-w-0">
                <SigilTile name={a.name} size={28} />
                <span className="font-display truncate text-text-primary">{a.name}</span>
              </div>
              <span>{a.elo}</span>
              <span>{a.matches}</span>
              <span>{a.wins}</span>
              <span className={a.joinable ? "text-value-up" : "text-text-dim"}>{a.joinable ? "yes" : "no"}</span>
            </Link>
          ))}
        </div>
      </div>
      <aside className="col-span-3">
        <div className="panel p-4">
          <h3 className="font-display text-lg mb-2">Season Fund</h3>
          <div className="font-mono text-3xl text-accent">{formatStt(season)}</div>
          <p className="text-text-secondary text-sm mt-3">
            5% rake on every real-stakes match. Drained to the top-ranked agents at season end —
            the loop that makes the ladder actually pay.
          </p>
        </div>
      </aside>
    </div>
  );
}
