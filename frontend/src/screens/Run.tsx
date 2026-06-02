import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { parseEther } from "viem";
import { fetchAllAgents } from "../chain/reads";
import {
  openExhibitionTx, openRealStakesTx, pokeOpenNextTx, realStakesValue, operatingValue,
  fetchSchedulerConfig, schedulerCanOpen, useTxAction, DEFAULT_LOTS, type SchedulerConfig,
} from "../chain/writes";
import { useInjectedWallet } from "../chain/wallet";
import { SigilTile } from "../components/SigilTile";
import { personaColorOf } from "../sigils/personas";
import { formatStt, shortAddr } from "../lib/format";
import type { Agent } from "../chain/types";

const EXPLORER_TX = "https://shannon-explorer.somnia.network/tx";
type MatchType = "exhibition" | "realstakes";

export default function Run() {
  const wallet = useInjectedWallet();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sched, setSched] = useState<SchedulerConfig | null>(null);

  const [type, setType] = useState<MatchType>("exhibition");
  const [rounds, setRounds] = useState(2);
  const [stake, setStake] = useState("1");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const open = useTxAction();
  const poke = useTxAction();

  useEffect(() => {
    (async () => {
      try {
        const all = await fetchAllAgents();
        setAgents(all);
        // default-seat the first 4 joinable agents (the house personas when free)
        const seed = all.filter((a) => a.joinable).slice(0, 4).map((a) => a.id.toString());
        setSelected(new Set(seed));
      } catch { /* leave empty */ }
      try { setSched(await fetchSchedulerConfig()); } catch { /* optional */ }
    })();
  }, []);

  function toggle(id: bigint) {
    setSelected((prev) => {
      const next = new Set(prev);
      const k = id.toString();
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  }

  const seats = selected.size;
  const agentIds = useMemo(
    () => agents.filter((a) => selected.has(a.id.toString())).map((a) => a.id),
    [agents, selected],
  );
  const entryWei = (() => { try { return parseEther((stake || "0") as `${number}`); } catch { return 0n; } })();
  const valid =
    seats >= 2 && seats <= 8 && rounds >= 1 && rounds <= 16 &&
    (type === "exhibition" || entryWei > 0n);
  const value = type === "realstakes"
    ? realStakesValue(seats, rounds, entryWei)
    : operatingValue(seats, rounds, DEFAULT_LOTS.length);

  async function doOpen() {
    if (!wallet.address) { await wallet.connect(); return; }
    const client = wallet.getClient();
    if (!client || !valid) return;
    const acct = wallet.address;
    open.run(() => type === "realstakes"
      ? openRealStakesTx(client, acct, { agentIds, rounds, entryStakeWei: entryWei })
      : openExhibitionTx(client, acct, { agentIds, rounds }));
  }
  async function doPoke() {
    if (!wallet.address) { await wallet.connect(); return; }
    const client = wallet.getClient();
    if (!client) return;
    poke.run(() => pokeOpenNextTx(client, wallet.address!));
  }

  const gate = sched ? schedulerCanOpen(sched) : null;

  return (
    <div className="p-6 grid grid-cols-12 gap-4">
      {/* OPEN A MATCH */}
      <section className="col-span-8 panel p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Run a match</h2>
          {wallet.address && (
            <span className="label-xs">connected <span className="font-mono text-text-primary">{shortAddr(wallet.address)}</span></span>
          )}
        </div>
        <p className="text-text-secondary text-sm mt-1 max-w-prose">
          Seat agents, pick the length, and open a match on-chain from your wallet. The board runs
          itself from there — pricing, negotiation, settlement.
        </p>

        {/* type toggle */}
        <div className="mt-5">
          <span className="label-sm">match type</span>
          <div className="mt-1 inline-flex border border-border-subtle rounded-sm overflow-hidden text-sm font-mono">
            {(["exhibition", "realstakes"] as MatchType[]).map((t) => (
              <button key={t} onClick={() => setType(t)}
                className={`px-4 py-1.5 ${type === t ? "bg-bg-panel-raised text-accent" : "text-text-secondary hover:text-text-primary"}`}>
                {t === "exhibition" ? "Exhibition" : "Real-stakes"}
              </button>
            ))}
          </div>
          <p className="label-xs mt-1.5 text-text-dim">
            {type === "exhibition"
              ? "no pot — you sponsor only the operating fee (mostly rebated to the Arena)."
              : "your wallet funds the pot; it pays out to the agents' owners at settlement."}
          </p>
        </div>

        {/* params */}
        <div className="mt-4 flex flex-wrap gap-5">
          <label className="block">
            <span className="label-sm">rounds <span className="text-text-dim">(turns/agent)</span></span>
            <input type="number" min={1} max={16} value={rounds}
              onChange={(e) => setRounds(Math.max(1, Math.min(16, Number(e.target.value) || 1)))}
              className="mt-1 w-24 bg-bg-base border border-border-subtle px-3 py-2 rounded-sm font-mono focus:outline-none focus:border-accent" />
          </label>
          {type === "realstakes" && (
            <label className="block">
              <span className="label-sm">stake <span className="text-text-dim">(STT/agent)</span></span>
              <input type="text" value={stake} onChange={(e) => setStake(e.target.value.replace(/[^0-9.]/g, ""))}
                className="mt-1 w-28 bg-bg-base border border-border-subtle px-3 py-2 rounded-sm font-mono focus:outline-none focus:border-accent" />
            </label>
          )}
          <div className="block">
            <span className="label-sm">seats</span>
            <div className="mt-1 px-3 py-2 font-mono text-text-primary">{seats} <span className="text-text-dim text-xs">/ 2–8</span></div>
          </div>
        </div>

        {/* agent multiselect */}
        <div className="mt-4">
          <span className="label-sm">agents <span className="text-text-dim">— pick 2–8 joinable</span></span>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {agents.map((a) => {
              const k = a.id.toString();
              const on = selected.has(k);
              const color = personaColorOf(a.name);
              return (
                <button key={k} disabled={!a.joinable} onClick={() => toggle(a.id)}
                  className={`panel p-2.5 flex items-center gap-2.5 text-left transition-all ${a.joinable ? "hover:border-border-strong" : "opacity-40 cursor-not-allowed"}`}
                  style={{ borderLeft: `2px solid ${color}`, ...(on ? { borderColor: color, boxShadow: `inset 0 0 0 1px ${color}` } : {}) }}>
                  <SigilTile name={a.name} size={30} state={on ? "thinking" : "idle"} />
                  <div className="min-w-0">
                    <div className="font-display text-[13px] truncate">{a.name}</div>
                    <div className="label-xs">elo {a.elo}{!a.joinable && " · in match"}</div>
                  </div>
                  <span className="ml-auto label-xs">{on ? "✓" : ""}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* lots (default feeds) */}
        <div className="mt-4">
          <span className="label-sm">lots <span className="text-text-dim">— default feeds</span></span>
          <div className="mt-1 flex gap-2 flex-wrap">
            {DEFAULT_LOTS.map((l) => (
              <span key={l.category} className="panel-raised px-2.5 py-1 font-mono text-xs">
                {l.category} <span className="text-text-dim">· {new URL(l.feedUrl).host}</span>
              </span>
            ))}
          </div>
        </div>

        {/* action */}
        <div className="border-t border-border-subtle mt-5 pt-4 flex items-center gap-3 flex-wrap">
          <button onClick={doOpen} disabled={open.status.kind === "signing" || open.status.kind === "pending" || (!!wallet.address && !valid)}
            className={`px-4 py-2 rounded-sm border font-display ${
              open.status.kind === "signing" || open.status.kind === "pending"
                ? "bg-bg-panel-raised border-border-strong text-text-dim cursor-wait"
                : (!!wallet.address && !valid) ? "border-border-subtle text-text-dim cursor-not-allowed"
                : "bg-accent border-accent text-bg-base hover:brightness-110"}`}>
            {!wallet.address ? (wallet.connecting ? "Connecting…" : "Connect Wallet")
              : open.status.kind === "signing" ? "Confirm in wallet…"
              : open.status.kind === "pending" ? "Opening…" : "▶ Open Match"}
          </button>
          <span className="label-xs text-text-secondary">
            you’ll send <span className="font-mono text-text-primary">~{formatStt(value)}</span>
            {type === "realstakes" && <span className="text-text-dim"> (pot {formatStt(entryWei * BigInt(seats))} + ops)</span>}
          </span>
        </div>
        <TxLine status={open.status} doneNote="match opened" liveLink />
        {!wallet.hasProvider && <p className="text-status-timeout text-xs mt-2">No injected wallet detected — install MetaMask.</p>}
      </section>

      {/* ADVANCE LEAGUE */}
      <aside className="col-span-4 panel p-4 self-start">
        <h3 className="font-display text-lg">Advance the league</h3>
        <p className="text-text-secondary text-sm mt-1.5">
          One click seats the top-{sched?.seatCount ?? 4} joinable agents by ELO into the next
          real-stakes match. The scheduler funds the pot — you only pay gas.
        </p>
        {sched && (
          <div className="mt-3 panel-raised p-3 space-y-1.5 text-xs font-mono">
            <Row k="scheduler balance" v={formatStt(sched.balance)} />
            <Row k="stake / match" v={`${formatStt(sched.entryStake)} × ${sched.seatCount}`} />
            <Row k="rounds" v={`${sched.rounds}`} />
            {gate && <Row k="status" v={gate.ok ? "ready" : `needs ${formatStt(gate.required)}`} accent={gate.ok} warn={!gate.ok} />}
          </div>
        )}
        <button onClick={doPoke} disabled={poke.status.kind === "signing" || poke.status.kind === "pending"}
          className={`mt-3 w-full px-4 py-2 rounded-sm border font-display ${
            poke.status.kind === "signing" || poke.status.kind === "pending"
              ? "bg-bg-panel-raised border-border-strong text-text-dim cursor-wait"
              : "border-accent text-accent hover:bg-accent hover:text-bg-base"}`}>
          {!wallet.address ? "Connect Wallet"
            : poke.status.kind === "signing" ? "Confirm in wallet…"
            : poke.status.kind === "pending" ? "Advancing…" : "▶ Advance League"}
        </button>
        <TxLine status={poke.status} doneNote="next match seated" liveLink />
        <p className="text-text-dim text-xs mt-3">
          Tip: the scheduler reserves 32 STT for reactivity, so it needs ≥ stake×seats + 32 STT to
          open. For minimal-STT matches use the form on the left instead.
        </p>
        <Link to="/" className="label-sm hover:text-accent mt-3 inline-block">← back to hub</Link>
      </aside>
    </div>
  );
}

function Row({ k, v, accent, warn }: { k: string; v: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-dim">{k}</span>
      <span className={warn ? "text-value-down" : accent ? "text-value-up" : "text-text-primary"}>{v}</span>
    </div>
  );
}

function TxLine({ status, doneNote, liveLink }: { status: ReturnType<typeof useTxAction>["status"]; doneNote: string; liveLink?: boolean }) {
  if (status.kind === "error") return <p className="text-value-down text-xs mt-2 break-words">{status.message}</p>;
  if (status.kind !== "pending" && status.kind !== "done") return null;
  return (
    <p className="text-xs mt-2">
      <span className={status.kind === "done" ? "text-value-up" : "text-status-pending"}>
        {status.kind === "done" ? `✓ ${doneNote}` : "⌛ pending"}
      </span>{" "}
      <a href={`${EXPLORER_TX}/${status.hash}`} target="_blank" rel="noreferrer" className="font-mono text-text-secondary hover:text-accent">
        {status.hash.slice(0, 12)}…
      </a>
      {status.kind === "done" && liveLink && <Link to="/live" className="text-accent hover:underline ml-2">watch live →</Link>}
    </p>
  );
}
