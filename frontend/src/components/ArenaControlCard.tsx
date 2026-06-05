import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  pokeOpenNextTx, fetchSchedulerConfig, schedulerCanOpen, useTxAction, type SchedulerConfig,
} from "../chain/writes";
import { useInjectedWallet } from "../chain/wallet";

const EXPLORER_TX = "https://shannon-explorer.somnia.network/tx";

/**
 * Compact kick-off card for the Hub. Setting up a custom match — picking the
 * traders and how many, the stake — lives on the Play page (/run), so the
 * primary action links there. The one-click "next league match" stays inline
 * because it needs no setup (top-N agents, scheduler-funded).
 */
export function ArenaControlCard() {
  const wallet = useInjectedWallet();
  const [sched, setSched] = useState<SchedulerConfig | null>(null);
  const poke = useTxAction();

  useEffect(() => {
    (async () => {
      try { setSched(await fetchSchedulerConfig()); } catch { /* ignore */ }
    })();
  }, []);

  async function doPoke() {
    if (!wallet.address) { await wallet.connect(); return; }
    const client = wallet.getClient();
    if (!client) return;
    poke.run(() => pokeOpenNextTx(client, wallet.address!));
  }

  const gate = sched ? schedulerCanOpen(sched) : null;
  const busyPoke = poke.status.kind === "signing" || poke.status.kind === "pending";

  return (
    <section className="panel p-4">
      <h3 className="font-display text-lg">Start a match</h3>
      <p className="text-text-secondary text-sm mt-1.5">
        Pick the AI traders and how many play, set the stake, and start it from
        your wallet — on the Play page.
      </p>

      {/* primary: head to the Play page to set one up (pick agents, stake) */}
      <Link
        to="/run"
        className="mt-3 flex w-full items-center justify-center gap-2 px-3 py-2 rounded-sm bg-accent border border-accent text-bg-base font-display text-sm hover:brightness-110"
      >
        ▶ Set up a match →
      </Link>

      {/* secondary: one-click league match — no setup, so it stays inline */}
      <div className="mt-3 pt-3 border-t border-border-subtle">
        <button onClick={doPoke} disabled={busyPoke}
          className={`w-full px-3 py-2 rounded-sm border font-display text-sm flex items-center justify-center gap-2 ${
            busyPoke ? "bg-bg-panel-raised border-border-strong text-text-dim cursor-wait"
            : "border-accent text-accent hover:bg-accent hover:text-bg-base"}`}>
          {!wallet.address ? "Connect Wallet" : busyPoke ? "Starting…" : "▶ Start next league match"}
        </button>
        <div className="label-xs mt-1.5 flex items-center justify-between">
          <span>top {sched?.seatCount ?? 4} agents by rating · one click</span>
          {gate && <span className={gate.ok ? "text-value-up" : "text-value-down"}>{gate.ok ? "ready" : "needs funds"}</span>}
        </div>
        <TxLine status={poke.status} note="started" liveLink />
      </div>
    </section>
  );
}

function TxLine({ status, note, liveLink }: { status: ReturnType<typeof useTxAction>["status"]; note: string; liveLink?: boolean }) {
  if (status.kind === "error") return <p className="text-value-down text-[11px] mt-1.5 break-words">{status.message}</p>;
  if (status.kind !== "pending" && status.kind !== "done") return null;
  return (
    <p className="text-[11px] mt-1.5">
      <span className={status.kind === "done" ? "text-value-up" : "text-status-pending"}>
        {status.kind === "done" ? `✓ ${note}` : "⌛ pending"}
      </span>{" "}
      <a href={`${EXPLORER_TX}/${status.hash}`} target="_blank" rel="noreferrer" className="font-mono text-text-secondary hover:text-accent">
        {status.hash.slice(0, 10)}…
      </a>
      {status.kind === "done" && liveLink && <Link to="/live" className="text-accent hover:underline ml-1.5">watch →</Link>}
    </p>
  );
}
