import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchAgent } from "../chain/reads";
import { publicClient } from "../chain/client";
import { CONTRACTS } from "../chain/config";
import { AGENT_REGISTRY_ABI } from "../chain/abis";
import { SigilTile } from "../components/SigilTile";
import { shortAddr, shortHex } from "../lib/format";
import type { Agent } from "../chain/types";

export default function AgentProfile() {
  const { id: idParam } = useParams();
  const id = idParam ? BigInt(idParam) : null;
  const [agent, setAgent] = useState<Agent | null>(null);
  const [owner, setOwner] = useState<string>("");

  useEffect(() => {
    if (id === null) return;
    let cancel = false;
    (async () => {
      const a = await fetchAgent(id);
      if (cancel) return;
      setAgent(a);
      try {
        const o = await publicClient.readContract({
          address: CONTRACTS.agentRegistry, abi: AGENT_REGISTRY_ABI,
          functionName: "ownerOf", args: [id],
        });
        if (!cancel) setOwner(o as string);
      } catch {}
    })();
    return () => { cancel = true; };
  }, [id]);

  if (id === null) return <div className="p-8">no agent specified.</div>;
  if (!agent) return <div className="p-8 text-text-secondary">loading agent #{id.toString()}…</div>;

  const winRate = agent.matches === 0 ? 0 : Math.round((agent.wins / agent.matches) * 100);

  return (
    <div className="p-6 grid grid-cols-12 gap-4">
      <header className="col-span-12 panel-raised p-5 flex items-center gap-5">
        <SigilTile name={agent.name} size={88} />
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-3xl">{agent.name}</h2>
          <div className="label-sm mt-1 flex gap-4 flex-wrap">
            <span>token id <span className="font-mono text-text-primary">#{agent.id.toString()}</span></span>
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
        <div className="grid grid-cols-2 gap-4 text-right font-mono">
          <Stat label="elo" value={agent.elo.toString()} />
          <Stat label="matches" value={agent.matches.toString()} />
          <Stat label="wins" value={agent.wins.toString()} />
          <Stat label="win rate" value={`${winRate}%`} />
        </div>
      </header>

      <section className="col-span-8 panel p-4">
        <h3 className="font-display text-lg mb-3">Strategy preview</h3>
        <p className="text-text-secondary text-sm">
          The agent's DNA is the prompt URI above — content-hashed at mint so it can't be silently
          edited mid-season. Re-staking requires a hash change, on-chain.
        </p>
        <pre className="mt-3 panel-raised p-3 font-mono text-xs whitespace-pre-wrap break-all text-text-secondary">
{agent.promptURI || "(no prompt URI set)"}
        </pre>
      </section>

      <aside className="col-span-4 panel p-4">
        <h3 className="font-display text-lg mb-2">Status</h3>
        <div className="space-y-2 text-sm">
          <Row label="joinable">{agent.joinable ? <span className="text-value-up">yes</span> : <span className="text-text-dim">in-match</span>}</Row>
          <Row label="elo">{agent.elo}</Row>
          <Row label="wins / matches">{agent.wins} / {agent.matches}</Row>
        </div>
        <div className="mt-4">
          <Link to="/ladder" className="label-sm text-accent hover:underline">← back to ladder</Link>
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label-xs">{label}</div>
      <div className="text-xl">{value}</div>
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
