import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { parseEther } from "viem";
import { fetchAllAgents } from "../chain/reads";
import {
  openExhibitionTx, openRealStakesTx, pokeOpenNextTx,
  fetchSchedulerConfig, schedulerCanOpen, useTxAction, type SchedulerConfig,
} from "../chain/writes";
import { useInjectedWallet } from "../chain/wallet";
import { formatStt } from "../lib/format";

const EXPLORER_TX = "https://shannon-explorer.somnia.network/tx";
type MatchType = "exhibition" | "realstakes";

/**
 * Compact kick-off card for the Hub: one-click Advance-League + a quick Open-Match
 * (type + rounds) over the first four joinable agents. Full control lives at /run.
 */
export function ArenaControlCard() {
  const wallet = useInjectedWallet();
  const [seatIds, setSeatIds] = useState<bigint[]>([]);
  const [sched, setSched] = useState<SchedulerConfig | null>(null);
  const [type, setType] = useState<MatchType>("exhibition");
  const [rounds, setRounds] = useState(2);
  const open = useTxAction();
  const poke = useTxAction();

  useEffect(() => {
    (async () => {
      try {
        const all = await fetchAllAgents();
        setSeatIds(all.filter((a) => a.joinable).slice(0, 4).map((a) => a.id));
      } catch { /* ignore */ }
      try { setSched(await fetchSchedulerConfig()); } catch { /* ignore */ }
    })();
  }, []);

  async function doOpen() {
    if (!wallet.address) { await wallet.connect(); return; }
    const client = wallet.getClient();
    if (!client || seatIds.length < 2) return;
    const acct = wallet.address;
    open.run(() => type === "realstakes"
      ? openRealStakesTx(client, acct, { agentIds: seatIds, rounds, entryStakeWei: parseEther("1") })
      : openExhibitionTx(client, acct, { agentIds: seatIds, rounds }));
  }
  async function doPoke() {
    if (!wallet.address) { await wallet.connect(); return; }
    const client = wallet.getClient();
    if (!client) return;
    poke.run(() => pokeOpenNextTx(client, wallet.address!));
  }

  const gate = sched ? schedulerCanOpen(sched) : null;
  const busyOpen = open.status.kind === "signing" || open.status.kind === "pending";
  const busyPoke = poke.status.kind === "signing" || poke.status.kind === "pending";

  return (
    <section className="panel p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg">Start a match</h3>
        <Link to="/run" className="label-sm hover:text-accent">full setup →</Link>
      </div>

      {/* advance league */}
      <button onClick={doPoke} disabled={busyPoke}
        className={`mt-3 w-full px-3 py-2 rounded-sm border font-display text-sm flex items-center justify-center gap-2 ${
          busyPoke ? "bg-bg-panel-raised border-border-strong text-text-dim cursor-wait"
          : "border-accent text-accent hover:bg-accent hover:text-bg-base"}`}>
        {!wallet.address ? "Connect Wallet" : busyPoke ? "Starting…" : "▶ Start next league match"}
      </button>
      <div className="label-xs mt-1.5 flex items-center justify-between">
        <span>top {sched?.seatCount ?? 4} agents by rating</span>
        {gate && <span className={gate.ok ? "text-value-up" : "text-value-down"}>{gate.ok ? "ready" : "needs funds"}</span>}
      </div>
      <TxLine status={poke.status} note="started" />

      {/* quick open a match */}
      <div className="mt-3 pt-3 border-t border-border-subtle">
        <div className="flex items-center justify-between">
          <span className="label-sm">open a match</span>
          <div className="inline-flex border border-border-subtle rounded-sm overflow-hidden text-[11px] font-mono">
            {(["exhibition", "realstakes"] as MatchType[]).map((t) => (
              <button key={t} onClick={() => setType(t)}
                className={`px-2 py-0.5 ${type === t ? "bg-bg-panel-raised text-accent" : "text-text-secondary"}`}>
                {t === "exhibition" ? "exhibition" : "real-stakes"}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="label-xs">rounds</span>
          <button onClick={() => setRounds((r) => Math.max(1, r - 1))} className="panel-raised w-6 h-6 leading-none hover:border-accent">‹</button>
          <span className="font-mono text-sm w-5 text-center">{rounds}</span>
          <button onClick={() => setRounds((r) => Math.min(16, r + 1))} className="panel-raised w-6 h-6 leading-none hover:border-accent">›</button>
          <button onClick={doOpen} disabled={busyOpen || (!!wallet.address && seatIds.length < 2)}
            className={`ml-auto px-3 py-1.5 rounded-sm border font-display text-sm ${
              busyOpen ? "bg-bg-panel-raised border-border-strong text-text-dim cursor-wait"
              : "bg-accent border-accent text-bg-base hover:brightness-110"}`}>
            {!wallet.address ? "Connect" : busyOpen ? "Opening…" : "Open"}
          </button>
        </div>
        <p className="label-xs mt-1.5 text-text-dim normal-case tracking-normal">
          {type === "realstakes" ? "1 STT/agent · 4 players · you fund the prize pool" : "no stakes · you just cover a small running fee"}
        </p>
        <TxLine status={open.status} note="match started" liveLink />
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
