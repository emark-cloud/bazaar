import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchSchedulerStats, fetchTreasurySeasonFund, fetchArenaNextMatchId } from "../chain/reads";
import { formatStt } from "../lib/format";
import { BazaarMark } from "../sigils/BazaarMark";

function NavItem({ to, label, glyph }: { to: string; label: string; glyph: string }) {
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
      title={label}
    >
      <span className="text-lg leading-none font-display">{glyph}</span>
      <span className="label-xs mt-1">{label}</span>
    </NavLink>
  );
}

export default function AppShell() {
  const [stats, setStats] = useState<{ matches: bigint; season: bigint; sched: bigint } | null>(null);

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
    <div className="min-h-screen w-full flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 h-12 border-b border-border-subtle bg-bg-panel/60 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 font-display text-lg tracking-tight">
            <BazaarMark size={22} />
            Bazaar<span className="text-accent">.</span>
          </span>
          <span className="label-sm">autonomous on-chain agent marketplace</span>
        </div>
        <div className="flex items-center gap-6 label-sm">
          <span className="flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-live-dot" />
            shannon testnet · chain 50312
          </span>
          {stats && (
            <>
              <span>matches <span className="text-text-primary">{stats.matches.toString()}</span></span>
              <span>scheduler <span className="text-text-primary">{stats.sched.toString()}</span></span>
              <span>season fund <span className="text-text-primary">{formatStt(stats.season)}</span></span>
            </>
          )}
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Left rail */}
        <nav className="w-16 bg-bg-panel border-r border-border-subtle flex flex-col items-center py-2">
          <NavItem to="/"        label="HUB"   glyph="●" />
          <NavItem to="/live"    label="LIVE"  glyph="▶" />
          <NavItem to="/ladder"  label="LDR"   glyph="♛" />
          <NavItem to="/agents"  label="AGNT"  glyph="◈" />
          <NavItem to="/mint"    label="MINT"  glyph="+" />
        </nav>

        {/* Main */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
