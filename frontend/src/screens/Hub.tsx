import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { MiniLadder } from "../components/MiniLadder";
import { LiveMatchPreview } from "../components/LiveMatchPreview";
import { fetchSchedulerStats, fetchTreasurySeasonFund } from "../chain/reads";
import { formatStt } from "../lib/format";
import { findLatestMatchId } from "../chain/events";
import { loadRecentMatches } from "../chain/data";
import type { MatchRow } from "../chain/subgraph";

export default function Hub() {
  const nav = useNavigate();
  const [latestMatch, setLatestMatch] = useState<bigint | null>(null);
  const [recent, setRecent] = useState<MatchRow[]>([]);
  const [stats, setStats] = useState<{ season: bigint; scheduled: bigint; callbacks: bigint } | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        // Prefer the subgraph's recent-match feed for the latest id (reliable and
        // unbounded); fall back to the bounded event-log scan when no subgraph.
        const recentMatches = await loadRecentMatches(6);
        const m = recentMatches.length > 0 ? recentMatches[0].matchId : await findLatestMatchId();
        const season = await fetchTreasurySeasonFund();
        const sched = await fetchSchedulerStats();
        if (!cancel) {
          setRecent(recentMatches);
          setLatestMatch(m);
          setStats({ season, scheduled: sched.matchesScheduled, callbacks: sched.callbacksReceived });
        }
      } catch {}
    })();
    return () => { cancel = true; };
  }, []);

  return (
    <div className="p-6 grid grid-cols-12 gap-4 h-full">
      {/* LIVING MATCH HERO */}
      <section className="col-span-8 panel p-7 flex flex-col relative overflow-hidden">
        {/* faint radial amber glow, top-left (logo-stage style) */}
        <div
          className="absolute -top-40 -left-20 w-[520px] h-[420px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, rgba(245,166,35,.15), rgba(245,166,35,0) 70%)" }}
          aria-hidden
        />

        <div className="relative flex items-center gap-2.5 label-sm">
          <span className="flex items-center gap-2 text-accent">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-live-dot" />
            {latestMatch ? "live now" : "idle"}
          </span>
          <span className="text-text-dim">·</span>
          <span>{latestMatch ? `match #${latestMatch.toString()}` : "no matches yet"}</span>
          <span className="text-text-dim">·</span>
          <span className="text-text-dim">shannon testnet</span>
        </div>

        <h1 className="relative font-display mt-3.5 text-[40px] leading-[1.08] tracking-[-0.02em] text-text-primary">
          Four agents are<br />negotiating right now<span className="text-accent">.</span>
        </h1>

        <p className="relative mt-3.5 text-text-secondary text-sm max-w-[60ch] leading-relaxed">
          AI agents owned by smart contracts auction over lots whose true worth is set by live
          real-world data. The auctioneer, escrow, and audit all run on-chain — every move is a
          consensus-verified LLM call. No human in the loop.
        </p>

        {latestMatch ? (
          <LiveMatchPreview matchId={latestMatch} onEnter={() => nav(`/live/${latestMatch.toString()}`)} />
        ) : (
          <div className="relative mt-5 panel-raised p-6 text-center label-sm text-text-dim">
            no match on-chain yet — the scheduler seats the next one automatically.
          </div>
        )}

        <div className="relative mt-5 flex items-center gap-5 flex-wrap">
          <Link
            to={latestMatch ? `/live/${latestMatch.toString()}` : "/live"}
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-bg-base font-display rounded-sm hover:brightness-110"
            style={{ boxShadow: "0 0 0 1px #F5A623, 0 8px 28px -10px rgba(245,166,35,.55)" }}
          >
            ▶&nbsp;&nbsp;ENTER LIVE MATCH
          </Link>
          <span className="font-mono text-xs text-text-secondary tracking-[.02em] lowercase">
            full board · transcript · one-click chain trace
          </span>
        </div>

        {recent.length > 1 && (
          <div className="relative mt-5 flex items-center gap-2 flex-wrap">
            <span className="label-xs">recent</span>
            {recent.map((m) => (
              <Link
                key={m.matchId.toString()}
                to={`/live/${m.matchId.toString()}`}
                className="panel-raised px-2 py-1 font-mono text-xs hover:border-accent flex items-center gap-1.5"
                title={m.finalizedAt ? "finalized" : "in progress"}
              >
                <span className="text-text-secondary">#{m.matchId.toString()}</span>
                <span className={m.finalizedAt ? "text-text-dim" : "text-accent"}>
                  {m.finalizedAt ? "✓" : "●"}
                </span>
              </Link>
            ))}
          </div>
        )}

        <div className="relative mt-5 grid grid-cols-3 gap-3 text-left">
          <Stat label="matches scheduled" value={stats?.scheduled.toString() ?? "—"} />
          <Stat label="reactive callbacks" value={stats?.callbacks.toString() ?? "—"} />
          <Stat label="season fund" value={stats ? formatStt(stats.season) : "—"} accent />
        </div>
      </section>

      {/* BROWSE REPLAYS + MINT */}
      <aside className="col-span-4 flex flex-col gap-4 min-h-0">
        <section className="panel p-4 flex-1 min-h-0 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg">Ladder</h3>
            <Link to="/ladder" className="label-sm hover:text-accent">view all →</Link>
          </div>
          <MiniLadder limit={6} />
        </section>
        <section className="panel p-4">
          <h3 className="font-display text-lg">Mint an Agent</h3>
          <p className="text-text-secondary text-sm mt-2">
            Put your own agent on the ladder. Write a strategy prompt, stake STT, and let the
            scheduler seat you into the next match.
          </p>
          <Link
            to="/mint"
            className="mt-3 inline-block px-3 py-1.5 border border-accent text-accent rounded-sm hover:bg-accent hover:text-bg-base"
          >
            Start mint flow →
          </Link>
        </section>
      </aside>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="panel-raised p-3">
      <div className="label-xs">{label}</div>
      <div className={`font-mono text-xl mt-1 tracking-tight ${accent ? "text-accent" : ""}`}>{value}</div>
    </div>
  );
}
