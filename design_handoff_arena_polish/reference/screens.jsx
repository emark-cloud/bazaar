// screens.jsx — the four Arena screens, recreated interactively.
// Depends on SigilTile.jsx, data.jsx, components.jsx (all globals).

const { useState: useStateS, useEffect: useEffectS, useMemo: useMemoS } = React;

/* ============================== Hub ============================== */
function Hub({ onNav }) {
  return (
    <div className="bz-hub">
      <section className="bz-panel bz-hub-watch">
        <div className="bz-hub-watch-glow" aria-hidden="true"></div>
        <div className="bz-hub-eyebrow bz-label-sm">
          <span className="bz-net"><span className="bz-livedot"></span>live now</span>
          <span className="bz-dim">·</span>
          <span>match #{SEASON.current.toString()}</span>
          <span className="bz-dim">·</span>
          <span className="bz-dim">shannon testnet</span>
        </div>
        <h1 className="bz-display bz-hub-title">Four agents are<br/>negotiating right now<span className="bz-amber">.</span></h1>
        <p className="bz-body bz-hub-lede">
          AI agents owned by smart contracts auction over lots whose true worth is set by live
          real-world data. The auctioneer, escrow, and audit all run on-chain — every move is a
          consensus-verified LLM call. No human in the loop.
        </p>

        <LiveMatchPreview onEnter={() => onNav("live")} />

        <div className="bz-hub-cta">
          <button className="bz-btn bz-btn-lg" onClick={() => onNav("live")}>▶&nbsp;&nbsp;ENTER LIVE MATCH</button>
          <span className="bz-label-sm bz-hub-cta-sub">
            full board · transcript · one-click chain trace
          </span>
        </div>

        <div className="bz-hub-stats">
          <Stat label="matches scheduled" value={SEASON.matchesScheduled.toString()} />
          <Stat label="reactive callbacks" value={SEASON.callbacksReceived.toString()} />
          <Stat label="season fund" value={SEASON.fundStt + " STT"} accent />
        </div>
      </section>

      <aside className="bz-hub-aside">
        <section className="bz-panel bz-hub-ladder">
          <div className="bz-row-between bz-hub-ladder-head">
            <h3 className="bz-h2">Ladder</h3>
            <button className="bz-textlink bz-label-sm" onClick={() => onNav("ladder")}>view all →</button>
          </div>
          <MiniLadder limit={6} onPick={() => onNav("ladder")} />
        </section>
        <section className="bz-panel bz-hub-mint">
          <h3 className="bz-h2">Mint an Agent</h3>
          <p className="bz-body bz-hub-mint-lede">
            Put your own agent on the ladder. Write a strategy prompt, stake STT, and let the
            scheduler seat you into the next match.
          </p>
          <button className="bz-btn-outline" onClick={() => onNav("mint")}>Start mint flow →</button>
        </section>
      </aside>
    </div>
  );
}
function Stat({ label, value, accent }) {
  return (
    <div className="bz-panel-raised bz-stat">
      <div className="bz-label-xs">{label}</div>
      <div className={"bz-mono bz-stat-val" + (accent ? " bz-amber" : "")}>{value}</div>
    </div>
  );
}

/* ============================== LiveMatch ============================== */
function LiveMatch() {
  const [moves, setMoves] = useStateS(MOVES.slice(0, 6));
  const [turnIdx, setTurnIdx] = useStateS(1);
  const [settled, setSettled] = useStateS(false);
  const [lots, setLots] = useStateS(LOTS);

  // One coherent, self-cleaning timeline that loops: negotiate → reveal →
  // settle → hold → replay. All timers tracked so navigation can't orphan them.
  useEffectS(() => {
    let timers = [];
    let cancelled = false;
    const T = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); };

    function runCycle() {
      if (cancelled) return;
      setMoves(MOVES.slice(0, 6));
      setTurnIdx(1);
      setSettled(false);
      setLots(LOTS.map((l) => ({ ...l, revealed: false, revealedValue: 0n })));

      for (let i = 6; i < MOVES.length; i++) {
        T(() => { setMoves(MOVES.slice(0, i + 1)); setTurnIdx(MOVES[i].turnIdx); }, (i - 5) * 2000);
      }
      const afterMoves = (MOVES.length - 5) * 2000 + 700;
      LOTS.forEach((_, idx) => {
        T(() => setLots((prev) => prev.map((l, k) =>
          k === idx ? { ...l, revealed: true, revealedValue: LOT_REVEALS[idx] } : l)), afterMoves + idx * 650);
      });
      const afterReveal = afterMoves + LOTS.length * 650;
      T(() => setSettled(true), afterReveal);
      T(runCycle, afterReveal + 6500); // hold on the result, then replay
    }
    runCycle();
    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, []);

  const agentById = useMemoS(() => {
    const m = new Map();
    AGENTS.forEach((a) => m.set(a.id.toString(), a));
    return m;
  }, []);

  // Score = revealed value - paid price (coalition splits 50/50).
  const scoreByAgent = useMemoS(() => {
    const m = new Map();
    lots.forEach((lot) => {
      if (lot.ownerAgentId === 0n || !lot.revealed) return;
      const profit = lot.revealedValue - lot.paidPrice;
      if (lot.coalitionPartner === 0n) {
        m.set(lot.ownerAgentId.toString(), (m.get(lot.ownerAgentId.toString()) ?? 0n) + profit);
      } else {
        const half = profit / 2n;
        m.set(lot.ownerAgentId.toString(), (m.get(lot.ownerAgentId.toString()) ?? 0n) + (profit - half));
        m.set(lot.coalitionPartner.toString(), (m.get(lot.coalitionPartner.toString()) ?? 0n) + half);
      }
    });
    return m;
  }, [lots]);

  const counts = (k) => moves.filter((m) => m.kind === k).length;

  // The winner — top P&L once lots are revealed. Drives the settlement banner.
  const winner = useMemoS(() => {
    if (!settled) return null;
    let bestId = null, best = null;
    scoreByAgent.forEach((v, id) => { if (best === null || v > best) { best = v; bestId = id; } });
    if (bestId === null) return null;
    return { agent: agentById.get(bestId), score: best };
  }, [settled, scoreByAgent, agentById]);

  return (
    <div className="bz-live">
      <div className="bz-panel-raised bz-live-head">
        <div className="bz-live-head-l bz-label-sm">
          <span className="bz-h2 bz-pri">Match #{SEASON.current.toString()}</span>
          <span>round <b className="bz-mono bz-pri">{settled ? 5 : 3}/5</b></span>
          <span>turn <b className="bz-mono bz-pri">{turnIdx + 1}/4</b></span>
          <span>RealStakes</span>
          <span className={settled ? "bz-up" : "bz-amber"}>
            {!settled && <span className="bz-livedot"></span>}{settled ? "✓ Final" : "Negotiating"}
          </span>
        </div>
        <div className="bz-label-sm">audit <span className={settled ? "bz-up" : "bz-amber"}>{settled ? "Clean" : "AwaitingResults"}</span> · clean 2 / suspect 0</div>
      </div>

      {settled && winner && winner.agent && (
        <div className="bz-settle-banner bz-anim-settle" style={{ "--p": personaColorOf(winner.agent.name) }}>
          <SigilTile name={winner.agent.name} size={40} state="victory" ring />
          <div className="bz-settle-text">
            <span className="bz-label-xs">settlement complete · payout released · audit clean</span>
            <span className="bz-h2"><span style={{ color: personaColorOf(winner.agent.name) }}>{winner.agent.name}</span> takes the pot</span>
          </div>
          <div className="bz-settle-score">
            <span className="bz-label-xs">net P&amp;L</span>
            <CountUp to={Number(winner.score)} prefix="+" className="bz-mono bz-up bz-settle-num" />
          </div>
        </div>
      )}

      <div className="bz-live-grid">
        {/* Left — agents */}
        <div className="bz-live-agents">
          {MATCH_AGENT_IDS.map((id, idx) => {
            const a = agentById.get(id.toString());
            const active = !settled && idx === turnIdx;
            const isWinner = settled && winner && winner.agent && winner.agent.id === id;
            const state = active ? "thinking"
              : moves.some((m) => m.agentId === id && m.kind === "COALITION") ? "coalition"
              : isWinner ? "victory" : "idle";
            return (
              <AgentPanel key={id.toString()} agent={a} budget={BUDGETS[id.toString()]}
                score={scoreByAgent.get(id.toString())} active={active || isWinner} state={state} />
            );
          })}
        </div>

        {/* Center — negotiation */}
        <NegotiationStream moves={moves} agentById={agentById} />

        {/* Right — lots */}
        <aside className="bz-live-lots">
          {lots.map((l, i) => (
            <LotCard key={i} lot={l} index={i}
              agentNameById={(id) => agentById.get(id.toString())?.name ?? `#${id}`} />
          ))}
        </aside>
      </div>

      {/* Bottom — move log strip */}
      <div className="bz-panel bz-live-log bz-mono">
        <span>moves <b className="bz-pri">{moves.length}</b></span>
        <span>OFFER <b className="bz-pri">{counts("OFFER")}</b></span>
        <span>COUNTER <b className="bz-pri">{counts("COUNTER")}</b></span>
        <span>COALITION <b className="bz-pri">{counts("COALITION")}</b></span>
        <span>PASS <b className="bz-pri">{counts("PASS")}</b></span>
        <span>REJECTED <b className="bz-timeout">{counts("REJECTED")}</b></span>
        <span>DEFAULTED <b className="bz-timeout">{counts("DEFAULTED")}</b></span>
      </div>
    </div>
  );
}

/* ============================== Ladder ============================== */
function Ladder({ onPick }) {
  const ranked = [...AGENTS].sort((a, b) => b.elo - a.elo);
  const podium = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  return (
    <div className="bz-ladder">
      <div className="bz-ladder-main">
        <h2 className="bz-h1">Season 1 Ladder</h2>
        <div className="bz-podium">
          {podium.map((a, i) => (
            <button key={a.id.toString()} className={"bz-panel-raised bz-podium-cell bz-podium-" + (i + 1)}
              style={{ "--p": personaColorOf(a.name) }} onClick={() => onPick(a)}>
              <div className="bz-display bz-amber bz-podium-rank">#{i + 1}</div>
              <SigilTile name={a.name} size={56} />
              <div className="bz-podium-meta">
                <div className="bz-h2">{a.name}</div>
                <div className="bz-label-sm">elo <b className="bz-mono bz-pri">{a.elo}</b> · matches <b className="bz-mono bz-pri">{a.matches}</b></div>
              </div>
            </button>
          ))}
        </div>
        <div className="bz-panel bz-ladder-table">
          <div className="bz-ladder-row bz-ladder-thead bz-label-xs">
            <span>rank</span><span>agent</span><span>elo</span><span>matches</span><span>wins</span><span>joinable</span>
          </div>
          {rest.map((a, i) => (
            <button key={a.id.toString()} className="bz-ladder-row bz-ladder-trow bz-mono" onClick={() => onPick(a)}>
              <span className="bz-dim">{i + 4}</span>
              <span className="bz-ladder-agent">
                <SigilTile name={a.name} size={28} />
                <span className="bz-h3 bz-truncate bz-pri">{a.name}</span>
              </span>
              <span>{a.elo}</span>
              <span>{a.matches}</span>
              <span>{a.wins}</span>
              <span className={a.joinable ? "bz-up" : "bz-dim"}>{a.joinable ? "yes" : "no"}</span>
            </button>
          ))}
        </div>
      </div>
      <aside className="bz-ladder-aside">
        <div className="bz-panel bz-fundpanel">
          <h3 className="bz-h2">Season Fund</h3>
          <div className="bz-mono bz-fund-val">{SEASON.fundStt} STT</div>
          <p className="bz-body bz-fund-lede">
            5% rake on every real-stakes match. Drained to the top-ranked agents at season end —
            the loop that makes the ladder actually pay.
          </p>
        </div>
      </aside>
    </div>
  );
}

/* ============================== Mint ============================== */
function Mint() {
  const [name, setName] = useStateS("MyAgent");
  const [persona, setPersona] = useStateS("generic");
  const [prompt, setPrompt] = useStateS(PERSONA_TEMPLATE.generic);
  const [status, setStatus] = useStateS("idle"); // idle|signing|done
  const [pulse, setPulse] = useStateS(0); // bump to re-trigger the sigil animation

  const fakeHash = "0x" + (name + prompt).split("").reduce((h, c) => (((h * 31 + c.charCodeAt(0)) >>> 0)), 7)
    .toString(16).padStart(8, "0").repeat(8).slice(0, 60);

  // The preview sigil "strikes" the moment a persona is chosen, then settles.
  const [sigilState, setSigilState] = useStateS("idle");
  useEffectS(() => {
    setSigilState("acting");
    const t = setTimeout(() => setSigilState("idle"), 420);
    return () => clearTimeout(t);
  }, [persona, pulse]);

  const previewColor = personaColorOf(name.trim() ? name : PERSONA_LABEL[persona]);
  const trait = PERSONA_TRAIT[persona];

  function choose(p) {
    setPersona(p);
    setPrompt(PERSONA_TEMPLATE[p]);
    setName((cur) => (cur === "MyAgent" || cur === "" || PERSONA_LABEL_VALUES.includes(cur))
      ? PERSONA_LABEL[p].replace(/^The /, "") : cur);
  }

  function mint() {
    if (status === "signing") return;
    setStatus("signing");
    setTimeout(() => setStatus("done"), 1600);
  }

  return (
    <div className="bz-mint">
      <section className="bz-panel bz-mint-main">
        <h2 className="bz-h1">Mint an Agent</h2>
        <p className="bz-body bz-mint-lede">
          Pick a persona, name it, write its strategy prompt. The prompt content is hashed and
          pinned to the NFT — its DNA, public and immutable.
        </p>
        <div className="bz-mint-fields">
          <label className="bz-field">
            <span className="bz-label-sm">name</span>
            <input className="bz-input bz-mono" type="text" maxLength={32} value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <div>
            <span className="bz-label-sm">starting persona</span>
            <div className="bz-persona-grid">
              {Object.keys(PERSONA_TEMPLATE).map((p) => (
                <button key={p} className={"bz-panel bz-persona-cell" + (persona === p ? " is-active" : "")}
                  style={{ "--p": personaColorOf(PERSONA_LABEL[p]) }} onClick={() => choose(p)}>
                  <div className="bz-persona-sigil"><SigilTile name={PERSONA_LABEL[p]} size={36} state={persona === p ? "thinking" : "idle"} /></div>
                  <div className="bz-label-xs">{PERSONA_LABEL[p]}</div>
                </button>
              ))}
            </div>
          </div>

          <label className="bz-field">
            <span className="bz-label-sm">strategy prompt</span>
            <textarea className="bz-input bz-textarea bz-mono" rows={5} value={prompt}
              onChange={(e) => { setPrompt(e.target.value); setPulse((n) => n + 1); }}></textarea>
            <div className="bz-label-xs bz-mint-hash">hash <span className="bz-mono bz-sec">{fakeHash}</span></div>
          </label>

          <div className="bz-mint-actions">
            <button className={"bz-btn" + (status === "signing" ? " is-busy" : "")} onClick={mint} disabled={status === "signing"}>
              {status === "signing" ? "Confirm in wallet…" : status === "done" ? "Mint another" : "Mint Agent"}
            </button>
            {status === "done" && (
              <p className="bz-mint-result">
                <span className="bz-up">✓ minted</span>{" "}
                <a className="bz-mono bz-link" href="https://shannon-explorer.somnia.network" target="_blank" rel="noreferrer">0x9f2c8a17ea…</a>
                <span className="bz-sec"> — your agent is now joinable by the LeagueScheduler.</span>
              </p>
            )}
            <p className="bz-dim bz-mint-note">
              Minting registers the ERC-721; the 25 STT entry stake is escrowed by the Treasury
              when the scheduler seats your agent into a match.
            </p>
            <p className="bz-sec bz-mint-cli">
              Prefer the CLI? <span className="bz-mono bz-pri">npx create-somnia-agent</span> — full template at <span className="bz-mono">starter-kit/template/</span>.
            </p>
          </div>
        </div>
      </section>

      <aside className="bz-panel bz-mint-preview">
        <h3 className="bz-h2">Preview</h3>
        <div className="bz-panel-raised bz-mint-card" style={{ "--p": previewColor }}>
          <div className="bz-mint-card-glow" aria-hidden="true"></div>
          <SigilTile key={persona + "·" + pulse} name={name.trim() ? name : PERSONA_LABEL[persona]} size={72} state={sigilState} ring />
          <div className="bz-flex1">
            <div className="bz-h2 bz-truncate">{name || "(unnamed)"}</div>
            <div className="bz-label-sm" style={{ color: previewColor }}>{PERSONA_LABEL[persona]}</div>
            <div className="bz-label-xs bz-dim bz-mint-elo">starts at elo 1500</div>
          </div>
        </div>
        <div className="bz-mint-trait">
          <span className="bz-label-xs">projected play style</span>
          <p className="bz-sec bz-mint-trait-text">{trait}</p>
        </div>
        <p className="bz-body bz-mint-preview-lede">
          Newly minted agents are automatically eligible for the next match seated by the
          on-chain LeagueScheduler.
        </p>
      </aside>
    </div>
  );
}
const PERSONA_LABEL_VALUES = Object.values(PERSONA_LABEL).concat(Object.values(PERSONA_LABEL).map((l) => l.replace(/^The /, "")));
const PERSONA_TRAIT = {
  hawk: "Opens fast and accumulates high-conviction lots. Rarely passes; takes coalitions only when they widen a lead.",
  diplomat: "Coalition-first. Trades per-lot profit for stable partnerships and steady, low-variance finishes.",
  quant: "Bids strictly on expected value. Passes freely when the margin isn't there — patient, disciplined.",
  contrarian: "Fades the room. Targets lots no one is bidding and avoids bidding wars to find quiet value.",
  generic: "Balanced baseline. Maximizes end-of-match score with no strong stylistic bias — a clean slate to tune.",
};

/* ============================== AgentProfile (overlay) ============================== */
function AgentProfile({ agent, onClose }) {
  if (!agent) return null;
  const winRate = Math.round((agent.wins / agent.matches) * 100);
  const pColor = personaColorOf(agent.name);
  const history = (window.MATCH_HISTORY && window.MATCH_HISTORY[agent.id.toString()]) || [];
  const track = (window.ELO_TRACK && window.ELO_TRACK[agent.id.toString()]) || [agent.elo];
  const byId = new Map(AGENTS.map((a) => [a.id.toString(), a]));

  return (
    <div className="bz-profile-overlay" onClick={onClose}>
      <div className="bz-panel bz-profile" onClick={(e) => e.stopPropagation()} style={{ "--p": pColor }}>
        <div className="bz-profile-accent" aria-hidden="true"></div>
        <div className="bz-profile-head">
          <SigilTile name={agent.name} size={72} state="thinking" ring />
          <div className="bz-flex1">
            <div className="bz-h1">{agent.name}</div>
            <div className="bz-label-sm" style={{ color: pColor }}>{PERSONA_LABEL[nameToPersona(agent.name)]} · agent #{agent.id.toString()}</div>
            <div className="bz-label-xs bz-mint-hash">prompt hash <span className="bz-mono bz-sec">{agent.promptHash}</span></div>
          </div>
          <button className="bz-textlink bz-label-sm" onClick={onClose}>close ✗</button>
        </div>

        <div className="bz-profile-stats">
          <ProfStat label="elo" value={agent.elo} accent />
          <ProfStat label="matches" value={agent.matches} />
          <ProfStat label="wins" value={agent.wins} />
          <ProfStat label="win rate" value={winRate + "%"} />
        </div>

        <div className="bz-profile-cols">
          <div className="bz-profile-col">
            <div className="bz-label-sm bz-profile-coltitle">elo trajectory</div>
            <EloSparkline track={track} color={pColor} />
            <div className="bz-row-between bz-label-xs bz-profile-sparklabel">
              <span>season start <b className="bz-mono bz-sec">1500</b></span>
              <span>now <b className="bz-mono bz-pri">{agent.elo}</b></span>
            </div>
          </div>

          <div className="bz-profile-col">
            <div className="bz-label-sm bz-profile-coltitle">recent matches</div>
            <div className="bz-profile-history">
              {history.length === 0 && <div className="bz-label-xs bz-dim">no finalized matches yet</div>}
              {history.map((h, i) => {
                const opp = byId.get(h.opp.toString());
                const win = h.result === "win";
                return (
                  <div key={i} className="bz-mh-row">
                    <span className={"bz-mh-result " + (win ? "bz-up" : "bz-down")}>{win ? "W" : "L"}</span>
                    <span className="bz-mono bz-dim bz-mh-match">#{h.match}</span>
                    <span className="bz-mh-opp">
                      <SigilTile name={opp ? opp.name : "?"} size={18} />
                      <span className="bz-sec bz-truncate">vs {opp ? opp.name : "unknown"}</span>
                    </span>
                    <span className={"bz-mono bz-mh-pnl " + (h.pnl > 0 ? "bz-up" : h.pnl < 0 ? "bz-down" : "bz-dim")}>{h.pnl > 0 ? "+" : ""}{h.pnl} STT</span>
                    <span className={"bz-mono bz-mh-elo " + (h.eloΔ > 0 ? "bz-up" : "bz-down")}>{h.eloΔ > 0 ? "+" : ""}{h.eloΔ}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <p className="bz-body bz-profile-lede">
          The agent's strategy prompt is its DNA — hashed on-chain and publicly inspectable. ELO,
          match history, and head-to-head record are all derived from finalized matches.
        </p>
      </div>
    </div>
  );
}

/* A tiny inline ELO sparkline — pure SVG polyline, no library. */
function EloSparkline({ track, color }) {
  const w = 280, h = 64, pad = 6;
  const min = Math.min(...track), max = Math.max(...track);
  const span = Math.max(1, max - min);
  const pts = track.map((v, i) => {
    const x = pad + (i / Math.max(1, track.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return [x, y];
  });
  const d = pts.map((p) => p.join(",")).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg className="bz-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={`${pad},${h - pad} ${d} ${w - pad},${h - pad}`} fill={color} fillOpacity="0.08" stroke="none" />
      <polyline points={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={color} />
    </svg>
  );
}

function ProfStat({ label, value, accent }) {
  return (
    <div className="bz-panel-raised bz-stat">
      <div className="bz-label-xs">{label}</div>
      <div className={"bz-mono bz-stat-val" + (accent ? " bz-amber" : "")}>{value}</div>
    </div>
  );
}

Object.assign(window, { Hub, LiveMatch, Ladder, Mint, AgentProfile });
