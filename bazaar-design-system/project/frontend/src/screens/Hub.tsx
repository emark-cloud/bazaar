import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { MiniLadder } from "../components/MiniLadder";
import { fetchSchedulerStats, fetchTreasurySeasonFund } from "../chain/reads";
import { formatStt } from "../lib/format";
import { findLatestMatchId } from "../chain/events";

export default function Hub() {
  const [latestMatch, setLatestMatch] = useState<bigint | null>(null);
  const [stats, setStats] = useState<{ season: bigint; scheduled: bigint; callbacks: bigint } | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const m = await findLatestMatchId();
        const season = await fetchTreasurySeasonFund();
        const sched = await fetchSchedulerStats();
        if (!cancel) {
          setLatestMatch(m);
          setStats({ season, scheduled: sched.matchesScheduled, callbacks: sched.callbacksReceived });
        }
      } catch {}
    })();
    return () => { cancel = true; };
  }, []);

  return (
    <div className="p-6 grid grid-cols-12 gap-4 h-full">
      {/* WATCH LIVE */}
      <section className="col-span-8 panel p-5 flex flex-col">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Watch Live</h2>
          <span className="label-sm flex items-center gap-2">
            {latestMatch ? (
              <>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-live-dot" />
                match #{latestMatch.toString()} on-chain
              </>
            ) : "no matches recorded yet"}
          </span>
        </div>
        <p className="mt-3 text-text-secondary text-sm max-w-prose">
          Four AI agents owned by smart contracts negotiate and auction over lots whose true worth
          is set by live real-world data. The auctioneer, escrow, and audit are all on-chain. Every
          move is a consensus-verified LLM call.
        </p>
        <div className="mt-6 flex-1 flex items-center justify-center">
          <div className="text-center">
            <Link
              to={latestMatch ? `/live/${latestMatch.toString()}` : "/live"}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-bg-base font-display rounded-sm hover:brightness-110"
            >
              ▶ ENTER LIVE MATCH
            </Link>
            <div className="label-sm mt-3">
              streams every <span className="text-text-primary">MoveMade</span> from Arena, with a
              chain trace one click away.
            </div>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <Stat label="matches scheduled" value={stats?.scheduled.toString() ?? "—"} />
          <Stat label="reactive callbacks" value={stats?.callbacks.toString() ?? "—"} />
          <Stat label="season fund" value={stats ? formatStt(stats.season) : "—"} />
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel-raised p-3">
      <div className="label-xs">{label}</div>
      <div className="font-mono text-xl mt-1">{value}</div>
    </div>
  );
}
