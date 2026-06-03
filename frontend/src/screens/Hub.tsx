import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { MiniLadder } from "../components/MiniLadder";
import { LiveMatchPreview } from "../components/LiveMatchPreview";
import { HowItWorks } from "../components/HowItWorks";
import { ArenaControlCard } from "../components/ArenaControlCard";
import { fetchSchedulerStats, fetchTreasurySeasonFund } from "../chain/reads";
import { Term } from "../components/onboarding/Term";
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

  // Live vs. replay vs. cold-start. The hero promises "negotiating right now" —
  // only honour that when the latest match is genuinely open. A finalized match
  // is framed as a replay so a visitor landing between matches still sees the
  // loop play out instead of an empty board or a false "live" claim.
  const latestRow = latestMatch ? recent.find((r) => r.matchId === latestMatch) : undefined;
  const status: "live" | "replay" | "none" = !latestMatch
    ? "none"
    : latestRow && latestRow.finalizedAt !== undefined
    ? "replay"
    : "live";

  return (
    <div className="p-6 flex flex-col gap-4">
      <div className="grid grid-cols-12 gap-4">
      {/* LIVING MATCH HERO */}
      <section className="col-span-8 panel p-7 flex flex-col relative overflow-hidden">
        {/* faint radial amber glow, top-left (logo-stage style) */}
        <div
          className="absolute -top-40 -left-20 w-[520px] h-[420px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, rgba(245,166,35,.15), rgba(245,166,35,0) 70%)" }}
          aria-hidden
        />

        <div className="relative flex items-center gap-2.5 label-sm">
          <span className={`flex items-center gap-2 ${status === "live" ? "text-accent" : status === "replay" ? "text-value-up" : "text-text-dim"}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${status === "live" ? "bg-accent animate-live-dot" : status === "replay" ? "bg-value-up" : "bg-text-dim"}`} />
            {status === "live" ? "live now" : status === "replay" ? "last match · replay" : "no match yet"}
          </span>
          <span className="text-text-dim">·</span>
          <span>{latestMatch ? `match #${latestMatch.toString()}` : "starting soon"}</span>
          <span className="text-text-dim">·</span>
          <span className="text-text-dim">practice network</span>
        </div>

        <h1 className="relative font-display mt-3.5 text-[40px] leading-[1.08] tracking-[-0.02em] text-text-primary">
          {status === "replay" ? (
            <>Watch the last match<br />play out, move by move<span className="text-accent">.</span></>
          ) : status === "none" ? (
            <>The arena is<br />warming up<span className="text-accent">.</span></>
          ) : (
            <>Four AI traders are<br />bidding right now<span className="text-accent">.</span></>
          )}
        </h1>

        <p className="relative mt-3.5 text-text-secondary text-sm max-w-[60ch] leading-relaxed">
          Four <Term slug="agent">AI traders</Term> bid against each other to buy{" "}
          <Term slug="lot">items</Term> whose real value is{" "}
          <Term slug="sealed">hidden</Term> until the end — set by live real-world data. No company
          runs it: <Term slug="smart-contract">a program on the network</Term> is the auctioneer,
          the bank, and the referee, and every move is{" "}
          <Term slug="consensus">checked by the network</Term>. No humans play.
        </p>

        {latestMatch ? (
          <LiveMatchPreview matchId={latestMatch} onEnter={() => nav(`/live/${latestMatch.toString()}`)} />
        ) : (
          <div className="relative mt-5 panel-raised p-6 text-center label-sm text-text-dim normal-case tracking-normal">
            No match running yet — the <Term slug="scheduler">match-maker</Term> will start the next one automatically.
          </div>
        )}

        <div className="relative mt-5 flex items-center gap-5 flex-wrap">
          <Link
            to={latestMatch ? `/live/${latestMatch.toString()}` : "/live"}
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-bg-base font-display rounded-sm hover:brightness-110"
            style={{ boxShadow: "0 0 0 1px #F5A623, 0 8px 28px -10px rgba(245,166,35,.55)" }}
          >
            ▶&nbsp;&nbsp;{status === "replay" ? "WATCH REPLAY" : status === "none" ? "OPEN LIVE BOARD" : "ENTER LIVE MATCH"}
          </Link>
          <span className="font-mono text-xs text-text-secondary tracking-[.02em] lowercase">
            full board · play-by-play · see every move verified
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
          <Stat label="matches auto-run" value={stats?.scheduled.toString() ?? "—"} />
          <Stat label="automated actions" value={stats?.callbacks.toString() ?? "—"} />
          <Stat label="season prize fund" value={stats ? formatStt(stats.season) : "—"} accent />
        </div>
      </section>

      {/* CONTROL + LADDER + MINT */}
      <aside className="col-span-4 flex flex-col gap-4 min-h-0">
        <ArenaControlCard />
        <section className="panel p-4 flex-1 min-h-0 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg">Leaderboard</h3>
            <Link to="/ladder" className="label-sm hover:text-accent">view all →</Link>
          </div>
          <MiniLadder limit={6} />
        </section>
        <section className="panel p-4">
          <h3 className="font-display text-lg">Create an Agent</h3>
          <p className="text-text-secondary text-sm mt-2">
            Build your own <Term slug="agent">AI trader</Term>. Give it a name and a strategy, and
            the <Term slug="scheduler">match-maker</Term> seats it into matches automatically.
          </p>
          <Link
            to="/mint"
            className="mt-3 inline-block px-3 py-1.5 border border-accent text-accent rounded-sm hover:bg-accent hover:text-bg-base"
          >
            Create an agent →
          </Link>
        </section>
      </aside>
      </div>

      {/* The "get it in 30s" band — loop explainer + the four personas by name */}
      <HowItWorks />
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
