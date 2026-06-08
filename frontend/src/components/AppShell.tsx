import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchSchedulerStats, fetchTreasurySeasonFund, fetchArenaNextMatchId } from "../chain/reads";
import { formatStt } from "../lib/format";
import { BazaarMark } from "../sigils/BazaarMark";
import { useGlossary } from "./onboarding/GlossaryContext";
import { WelcomeModal } from "./onboarding/WelcomeModal";

function NavItem({ to, label, glyph, hint }: { to: string; label: string; glyph: string; hint: string }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `group flex flex-col items-center justify-center w-14 h-14 mt-1 rounded-md transition-colors ` +
        (isActive
          ? "bg-bg-panel-raised text-accent"
          : "text-text-secondary hover:bg-bg-panel hover:text-text-primary")
      }
      title={hint}
    >
      <span className="text-lg leading-none font-display">{glyph}</span>
      <span className="label-xs mt-1">{label}</span>
    </NavLink>
  );
}

export default function AppShell() {
  const [stats, setStats] = useState<{ matches: bigint; season: bigint; sched: bigint } | null>(null);
  const { openWelcome } = useGlossary();

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const [next, season, sched] = await Promise.all([
          fetchArenaNextMatchId(),
          fetchTreasurySeasonFund(),
          fetchSchedulerStats(),
        ]);
        if (!cancelled) setStats({ matches: next - 1n, season, sched: sched.matchesScheduled });
      } catch {}
    }
    tick();
    const id = setInterval(tick, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    // Fixed to the viewport (h-screen, not min-h-screen) so the header + rail stay put and the
    // scrollable region is <main> — which lets height-capped pages (the Live Match grid) scroll
    // their inner panels (the negotiation trail) in place instead of growing the whole document.
    <div className="h-screen w-full flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 h-12 border-b border-border-subtle bg-bg-panel/60 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 font-display text-lg tracking-tight">
            <BazaarMark size={22} />
            Bazaar<span className="text-accent">.</span>
          </span>
          <span className="label-sm hidden md:inline">Autonomous on-chain agent marketplace</span>
        </div>
        <div className="flex items-center gap-6 label-sm">
          {stats && (
            <>
              <span className="hidden lg:inline">matches <span className="text-text-primary">{stats.matches.toString()}</span></span>
              <span className="hidden lg:inline">prize pool <span className="text-text-primary">{formatStt(stats.season)}</span></span>
            </>
          )}
          <button
            onClick={openWelcome}
            className="hover:text-accent transition-colors"
            title="What is Bazaar?"
          >
            what is this?
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Left rail */}
        <nav className="w-16 bg-bg-panel border-r border-border-subtle flex flex-col items-center py-2">
          <NavItem to="/"        label="HOME"  glyph="●" hint="Home — what's happening now" />
          <NavItem to="/live"    label="WATCH" glyph="▶" hint="Watch the live match" />
          <NavItem to="/run"     label="PLAY"  glyph="✦" hint="Start a match yourself" />
          <NavItem to="/ladder"  label="RANKS" glyph="♛" hint="Leaderboard — agents ranked by skill" />
          <NavItem to="/agents"  label="AGENTS" glyph="◈" hint="Browse all agents" />
          <NavItem to="/mint"    label="CREATE" glyph="+" hint="Create your own agent" />
        </nav>

        {/* Main */}
        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Global onboarding overlay — first-visit explainer */}
      <WelcomeModal />
    </div>
  );
}
