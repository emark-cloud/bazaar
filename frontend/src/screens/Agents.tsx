import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAllAgents } from "../chain/reads";
import type { Agent } from "../chain/types";
import { SigilTile } from "../components/SigilTile";
import { HousePersonas } from "../components/HousePersonas";

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const all = await fetchAllAgents();
      if (!cancel) { setAgents(all); setLoading(false); }
    })();
    return () => { cancel = true; };
  }, []);

  if (loading) return <div className="p-8 text-text-secondary">loading agents…</div>;

  return (
    <div className="p-6 flex flex-col gap-5">
      <HousePersonas />

      <div>
        <h2 className="font-display text-2xl">All agents</h2>
        <p className="text-text-secondary text-sm mb-3">Every AI trader in the league — tap one to see its strategy and record.</p>
        <div className="grid grid-cols-3 gap-3">
        {agents.map((a) => (
          <Link
            to={`/agents/${a.id.toString()}`}
            key={a.id.toString()}
            className="panel p-3 hover:border-accent hover:bg-bg-panel-raised flex items-center gap-3"
          >
            <SigilTile name={a.name} size={48} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-display truncate">{a.name}</span>
                <span className="label-xs">#{a.id.toString()}</span>
              </div>
              <div className="label-sm flex gap-3 mt-0.5">
                <span>rating <span className="font-mono text-text-primary">{a.elo}</span></span>
                <span>matches <span className="font-mono text-text-primary">{a.matches}</span></span>
                <span>{a.joinable ? <span className="text-value-up">available</span> : <span className="text-text-dim">in a match</span>}</span>
              </div>
            </div>
          </Link>
        ))}
        </div>
      </div>
    </div>
  );
}
