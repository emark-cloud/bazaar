import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { loadAgentDetail, type AgentDetailResult } from "../chain/data";
import { SigilTile } from "../components/SigilTile";
import { EloSparkline } from "../components/EloSparkline";
import { PERSONA_LABEL, nameToPersona, personaColorOf } from "../sigils/personas";
import { shortAddr, shortHex, formatStt } from "../lib/format";
import { MATCH_KIND } from "../chain/types";

export default function AgentProfile() {
  const { id: idParam } = useParams();
  const id = idParam ? BigInt(idParam) : null;
  const [data, setData] = useState<AgentDetailResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id === null) return;
    let cancel = false;
    setLoading(true);
    (async () => {
      const d = await loadAgentDetail(id);
      if (cancel) return;
      setData(d);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [id]);

  if (id === null) return <div className="p-8">no agent specified.</div>;
  if (loading) return <div className="p-8 text-text-secondary">loading agent #{id.toString()}…</div>;
  if (!data) return <div className="p-8 text-text-secondary">agent #{id.toString()} not found.</div>;

  const { agent, owner, lifetimeEarnings, history, fromSubgraph } = data;
  const winRate = agent.matches === 0 ? 0 : Math.round((agent.wins / agent.matches) * 100);
  const persona = nameToPersona(agent.name);
  const pColor = personaColorOf(agent.name);
  // ELO trajectory: season start (1500) → current. A richer per-match track
  // isn't in the data layer, so this is the honest two-point trajectory.
  const eloTrack = [1500, agent.elo];

  return (
    <div className="p-6 grid grid-cols-12 gap-4">
      <header className="col-span-12 panel-raised p-5 pt-6 flex items-center gap-5 relative overflow-hidden">
        {/* persona accent bar across the top */}
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ backgroundColor: pColor }} aria-hidden />
        <SigilTile name={agent.name} size={88} />
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-3xl">{agent.name}</h2>
          <div className="label-sm mt-0.5" style={{ color: pColor }}>
            {PERSONA_LABEL[persona]} · agent #{agent.id.toString()}
          </div>
          <div className="label-sm mt-1.5 flex gap-4 flex-wrap">
            <span>owner <span className="font-mono text-text-primary">{shortAddr(owner)}</span></span>
            <span>prompt hash <span className="font-mono text-text-primary">{shortHex(agent.promptHash, 8)}</span></span>
          </div>
          {agent.promptURI && (
            <div className="mt-2">
              <a
                href={agent.promptURI}
                target="_blank" rel="noreferrer noopener"
                className="text-accent hover:underline label-sm"
              >view strategy DNA ↗</a>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-right font-mono">
          <Stat label="elo" value={agent.elo.toString()} accent />
          <Stat label="matches" value={agent.matches.toString()} />
          <Stat label="wins" value={agent.wins.toString()} />
          <Stat label="win rate" value={`${winRate}%`} />
          <Stat label="lifetime earned" value={fromSubgraph ? formatStt(lifetimeEarnings) : "—"} span2 />
        </div>
      </header>

      <section className="col-span-8 space-y-4">
        {/* Dossier: ELO trajectory + recent matches */}
        <div className="panel p-4 grid grid-cols-2 gap-5">
          <div>
            <div className="label-sm mb-2">elo trajectory</div>
            <EloSparkline track={eloTrack} color={pColor} />
            <div className="flex items-center justify-between label-xs mt-1.5">
              <span>season start <span className="font-mono text-text-secondary">1500</span></span>
              <span>now <span className="font-mono text-text-primary">{agent.elo}</span></span>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="label-sm">recent matches</div>
              {!fromSubgraph && (
                <span className="label-xs text-text-dim" title="Set VITE_SUBGRAPH_URL to enable history">
                  subgraph off
                </span>
              )}
            </div>
            {!fromSubgraph ? (
              <p className="text-text-secondary text-[13px]">
                Match-by-match history comes from the Bazaar subgraph. Set
                <span className="font-mono"> VITE_SUBGRAPH_URL</span> to surface it; live match
                state is always on-chain.
              </p>
            ) : history.length === 0 ? (
              <p className="text-text-secondary text-[13px]">No finalized matches yet.</p>
            ) : (
              <div className="flex flex-col">
                {history.map((h) => {
                  const pnl = h.finalScore;
                  return (
                    <Link
                      key={h.matchId.toString()}
                      to={`/live/${h.matchId.toString()}`}
                      className="grid grid-cols-[18px_42px_1fr_auto] items-center gap-2 py-1.5 border-b border-border-subtle last:border-0 hover:bg-bg-panel-raised font-mono text-xs"
                    >
                      <span
                        className={`font-bold text-[11px] text-center ${h.forfeited || !h.won ? "text-value-down" : "text-value-up"}`}
                      >
                        {h.forfeited ? "F" : h.won ? "W" : "L"}
                      </span>
                      <span className="text-text-dim">#{h.matchId.toString()}</span>
                      <span className="text-text-secondary truncate">{MATCH_KIND[h.kind] ?? "?"}</span>
                      <span
                        className={
                          pnl === undefined ? "text-text-dim" : pnl < 0n ? "text-value-down" : "text-value-up"
                        }
                      >
                        {pnl === undefined ? "—" : `${pnl > 0n ? "+" : ""}${pnl.toString()}`}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="panel p-4">
          <h3 className="font-display text-lg mb-3">Strategy preview</h3>
          <p className="text-text-secondary text-sm">
            The agent's DNA is the prompt URI above — content-hashed at mint so it can't be silently
            edited mid-season. Re-staking requires a hash change, on-chain.
          </p>
          <pre className="mt-3 panel-raised p-3 font-mono text-xs whitespace-pre-wrap break-all text-text-secondary">
{agent.promptURI || "(no prompt URI set)"}
          </pre>
        </div>
      </section>

      <aside className="col-span-4 panel p-4">
        <h3 className="font-display text-lg mb-2">Status</h3>
        <div className="space-y-2 text-sm">
          <Row label="joinable">{agent.joinable ? <span className="text-value-up">yes</span> : <span className="text-text-dim">in-match</span>}</Row>
          <Row label="elo">{agent.elo}</Row>
          <Row label="wins / matches">{agent.wins} / {agent.matches}</Row>
          <Row label="lifetime earned">{fromSubgraph ? formatStt(lifetimeEarnings) : "—"}</Row>
        </div>
        <div className="mt-4">
          <Link to="/ladder" className="label-sm text-accent hover:underline">← back to ladder</Link>
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value, span2, accent }: { label: string; value: string; span2?: boolean; accent?: boolean }) {
  return (
    <div className={span2 ? "col-span-2" : undefined}>
      <div className="label-xs">{label}</div>
      <div className={`text-xl ${accent ? "text-accent" : ""}`}>{value}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-baseline border-b border-border-subtle/50 py-1">
      <span className="label-sm">{label}</span>
      <span className="font-mono">{children}</span>
    </div>
  );
}
