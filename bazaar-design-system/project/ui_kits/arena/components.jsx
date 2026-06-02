// components.jsx — reusable Arena UI components. Faithful, mostly-cosmetic
// recreations of the frontend components. Depends on SigilTile.jsx (globals).

const { useState } = React;

/* ============================== LiveMatchPreview ==============================
   The living hero. A real ticking mini-match: four agent sigils, a budget +
   lot board, and a negotiation ticker that streams moves in. This is what makes
   the entry screen feel autonomous before you read a word — never a cold hero. */
function LiveMatchPreview({ onEnter }) {
  const { useState: uS, useEffect: uE, useMemo: uM } = React;
  const [n, setN] = uS(3); // how many moves have "landed"

  const agentById = uM(() => {
    const m = new Map();
    AGENTS.forEach((a) => m.set(a.id.toString(), a));
    return m;
  }, []);

  // Stream moves in on a loop — the negotiation never stops.
  uE(() => {
    const id = setInterval(() => setN((p) => (p >= MOVES.length ? 4 : p + 1)), 2400);
    return () => clearInterval(id);
  }, []);

  const shown = MOVES.slice(0, n);
  const last = shown[shown.length - 1];
  const activeId = last ? last.agentId : MATCH_AGENT_IDS[0];
  const ticker = shown.slice(-3).reverse();

  return (
    <div className="bz-lmp">
      <div className="bz-lmp-board">
        {MATCH_AGENT_IDS.map((id) => {
          const a = agentById.get(id.toString());
          const active = id === activeId;
          return (
            <div key={id.toString()} className={"bz-lmp-agent" + (active ? " is-active" : "")}
              style={{ "--p": personaColorOf(a.name) }}>
              <SigilTile name={a.name} size={40} state={active ? "thinking" : "idle"} ring={active} />
              <div className="bz-lmp-agent-meta">
                <span className="bz-h3 bz-truncate">{a.name}</span>
                <span className="bz-mono bz-lmp-budget">{BUDGETS[id.toString()].toString()}<span className="bz-dim"> STT</span></span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bz-lmp-ticker" onClick={onEnter} title="Enter the live match">
        <div className="bz-lmp-ticker-head bz-label-xs">
          <span><span className="bz-livedot"></span>negotiation · live</span>
          <span className="bz-dim">round {Math.min(5, Math.ceil(n / 4))}/5</span>
        </div>
        <div className="bz-lmp-feed">
          {ticker.map((m, i) => (
            <TickerLine key={m.requestId.toString()} move={m} agent={agentById.get(m.agentId.toString())} fresh={i === 0} />
          ))}
        </div>
      </div>

      <div className="bz-lmp-lots">
        {LOTS.map((l, i) => (
          <div key={i} className="bz-lmp-lot" title={l.category}>
            <span className="bz-label-xs bz-truncate">{l.category}</span>
            <span className={"bz-lmp-lot-state " + (l.ownerAgentId !== 0n ? "is-sold" : "")}>
              {l.ownerAgentId !== 0n ? "✓ sold" : "⌛ sealed"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TickerLine({ move, agent, fresh }) {
  const name = agent ? agent.name : `Agent #${move.agentId}`;
  const color = personaColorOf(name);
  const p = parseMove(move.raw);
  let phrase = move.kind.toLowerCase();
  if (move.kind === "OFFER") phrase = `offers ${p.price} STT · lot ${p.lot}`;
  if (move.kind === "COUNTER") phrase = `counters ${p.price} · lot ${p.lot}`;
  if (move.kind === "COALITION") phrase = `coalition w/ agent ${p.partner}`;
  if (move.kind === "PASS") phrase = "passes";
  if (move.kind === "REJECTED") phrase = "rejected";
  if (move.kind === "DEFAULTED") phrase = "defaulted";
  const fail = move.kind === "REJECTED" || move.kind === "DEFAULTED";
  return (
    <div className={"bz-lmp-line" + (fresh ? " bz-anim-slideup" : "")}>
      <span className="bz-lmp-line-rule" style={{ background: color }}></span>
      <span className="bz-h3 bz-lmp-who" style={{ color }}>{name.replace(/-.*$/, "")}</span>
      <span className={"bz-sec bz-lmp-what" + (fail ? " bz-timeout" : "")}>{phrase}</span>
      <span className="bz-label-xs bz-lmp-kind">{move.kind}</span>
    </div>
  );
}

function personaColorOf(name) {
  const persona = nameToPersona(name);
  return persona === "generic" ? generatedColorFor(name) : PERSONA_COLOR[persona];
}

/* Count a number up from 0 → target on mount (easeOutCubic). Used for the
   settlement reveal: lot values flip then count, scores tick up. */
function CountUp({ to, dur = 700, prefix = "", className }) {
  const { useState: u1, useEffect: u2 } = React;
  const target = Number(to);
  const [val, setVal] = u1(0);
  u2(() => {
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(target * e));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return <span className={className}>{prefix}{val}</span>;
}

/* ---- helpers ---- */
function parseMove(raw) {
  const out = {};
  for (const tok of (raw || "").split("|")) {
    const m = tok.match(/^(lot|price|partner|share)=(.+)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}
function shortId(id) {
  const s = id.toString();
  return s.length <= 8 ? s : s.slice(0, 6) + "…";
}

/* ============================== AppShell ============================== */
function AppShell({ route, onNav, children }) {
  const nav = [
    { to: "hub", label: "HUB", glyph: "●" },
    { to: "live", label: "LIVE", glyph: "▶" },
    { to: "ladder", label: "LDR", glyph: "♛" },
    { to: "agents", label: "AGNT", glyph: "◈" },
    { to: "mint", label: "MINT", glyph: "+" },
  ];
  return (
    <div className="bz-shell">
      <header className="bz-topbar">
        <div className="bz-topbar-l">
          <span className="bz-wordmark"><span className="bz-amber">▲</span> BAZAAR</span>
          <span className="bz-label-sm bz-hide-sm">autonomous on-chain agent marketplace</span>
        </div>
        <div className="bz-topbar-r bz-label-sm">
          <span className="bz-net"><span className="bz-livedot"></span>shannon testnet · chain 50312</span>
          <span className="bz-hide-sm">matches <b>{SEASON.current.toString()}</b></span>
          <span className="bz-hide-sm">scheduler <b>{SEASON.matchesScheduled.toString()}</b></span>
          <span>season fund <b>{SEASON.fundStt} STT</b></span>
        </div>
      </header>
      <div className="bz-body">
        <nav className="bz-rail">
          {nav.map((n) => (
            <button
              key={n.to}
              className={"bz-railitem" + (route === n.to ? " is-active" : "")}
              onClick={() => onNav(n.to)}
              title={n.label}
            >
              <span className="bz-railglyph">{n.glyph}</span>
              <span className="bz-label-xs">{n.label}</span>
            </button>
          ))}
        </nav>
        <main className="bz-main">{children}</main>
      </div>
    </div>
  );
}

/* ============================== AgentPanel ============================== */
function AgentPanel({ agent, budget, score, active, state }) {
  const hasElo = "elo" in agent;
  const scoreNum = score === undefined ? undefined : Number(score);
  const pColor = personaColorOf(agent.name);
  const isWinner = state === "victory";
  return (
    <div className={"bz-agentpanel " + (active ? "bz-panel-raised is-active" : "bz-panel") + (isWinner ? " is-winner" : "")}
      style={{ "--p": pColor }}>
      <SigilTile name={agent.name} size={44} state={state || "idle"} ring={active || isWinner} />
      <div className="bz-agentpanel-body">
        <div className="bz-row-baseline">
          <span className="bz-h3 bz-truncate">{agent.name}</span>
          {isWinner
            ? <span className="bz-crown" title="match winner">♛</span>
            : <span className="bz-label-xs">#{agent.id.toString()}</span>}
        </div>
        <div className="bz-agentpanel-stats">
          {active && (
            <span className="bz-thinking">thinking<span className="bz-dots"><i></i><i></i><i></i></span></span>
          )}
          {!active && hasElo && <span className="bz-dim">elo {agent.elo}</span>}
          {budget !== undefined && (
            <span className="bz-sec">budget <b className="bz-pri">{budget.toString()}</b></span>
          )}
          {scoreNum !== undefined && (
            <CountUp to={scoreNum} prefix={scoreNum > 0 ? "+" : ""}
              className={"bz-score " + (scoreNum > 0 ? "bz-up" : scoreNum < 0 ? "bz-down" : "bz-dim")} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================== LotCard ============================== */
function sourceLabel(url) {
  try { return new URL(url).host; } catch { return (url || "").slice(0, 28); }
}
function LotCard({ lot, index, agentNameById }) {
  const sold = lot.ownerAgentId !== 0n;
  const standing = !sold && lot.standingOfferPrice !== 0n;
  return (
    <div className="bz-panel bz-lotcard">
      <div className="bz-row-between">
        <div className="bz-lot-head">
          <span className="bz-mono bz-dim">lot {index + 1}</span>
          <span className="bz-h3">{lot.category}</span>
        </div>
        <span className="bz-label-xs">{lot.valueHint}</span>
      </div>
      <div className="bz-row-between bz-lot-value">
        <span className="bz-label-sm">real-world value</span>
        <span className="bz-mono">
          {lot.revealed
            ? <CountUp to={lot.revealedValue} className="bz-up bz-anim-flip" />
            : <span className="bz-dim">⌛ sealed</span>}
        </span>
      </div>
      {lot.revealed && (
        <div className="bz-row-between bz-anim-fade">
          <span className="bz-label-xs">source</span>
          <a className="bz-label-xs bz-link bz-truncate" href={lot.feedUrl} target="_blank" rel="noreferrer" title={lot.feedUrl}>
            {sourceLabel(lot.feedUrl)}
          </a>
        </div>
      )}
      <div className="bz-row-between bz-lot-foot">
        {sold ? (
          <>
            <span className="bz-label-sm">sold to</span>
            <span className="bz-mono">
              {agentNameById(lot.ownerAgentId)} @ {lot.paidPrice.toString()}
              {lot.coalitionPartner !== 0n && <span className="bz-amber"> +{agentNameById(lot.coalitionPartner)}</span>}
            </span>
          </>
        ) : standing ? (
          <>
            <span className="bz-label-sm">standing</span>
            <span className="bz-mono bz-sec">{lot.standingOfferPrice.toString()} ← {agentNameById(lot.standingOfferBy)}</span>
          </>
        ) : (
          <span className="bz-label-sm bz-dim">open</span>
        )}
      </div>
    </div>
  );
}

/* ============================== TraceWaterfall ============================== */
function TraceWaterfall({ move }) {
  const reqStr = move.requestId ? move.requestId.toString() : "—";
  const spans = [
    { label: "createRequest", start: 0, width: 8 },
    { label: "subcommittee exec", start: 8, width: 56 },
    { label: "consensus reached", start: 64, width: 12 },
    { label: "handleMove callback", start: 76, width: 18 },
  ];
  return (
    <div className="bz-panel bz-trace">
      <div className="bz-row-between bz-trace-head">
        <div className="bz-sec"><span className="bz-dim">requestId</span> {reqStr}</div>
        <div className="bz-trace-meta">
          <span className="bz-dim">subcommittee 3 · Majority · deposit ~0.24 STT</span>
          <a className="bz-amber bz-link" href="https://shannon-explorer.somnia.network" target="_blank" rel="noreferrer">→ view receipt ↗</a>
        </div>
      </div>
      <div className="bz-trace-track">
        {spans.map((s, i) => (
          <div key={s.label} className="bz-span"
            style={{ left: s.start + "%", width: s.width + "%", top: i * 20 + 4 }} title={s.label}>
            <span className="bz-truncate">{s.label}</span>
          </div>
        ))}
      </div>
      {(move.kind === "REJECTED" || move.kind === "DEFAULTED") && (
        <div className="bz-trace-err">
          {move.kind.toLowerCase()}: <b className="bz-pri">{move.reason}</b>
        </div>
      )}
    </div>
  );
}

/* ============================== TranscriptLine ============================== */
function TranscriptLine({ move, agent, expanded, onClick, isLatest }) {
  const name = agent ? agent.name : `Agent #${move.agentId}`;
  const persona = agent ? nameToPersona(agent.name) : "generic";
  const color = persona === "generic" ? generatedColorFor(name) : PERSONA_COLOR[persona];
  const p = parseMove(move.raw);

  let phrase = move.raw;
  if (move.kind === "OFFER") phrase = `offers ${p.price ?? "?"} STT for lot ${p.lot ?? "?"}`;
  if (move.kind === "COUNTER") phrase = `counters at ${p.price ?? "?"} on lot ${p.lot ?? "?"}`;
  if (move.kind === "COALITION") phrase = `proposes coalition with agent ${p.partner ?? "?"} (share ${p.share ?? "50"})`;
  if (move.kind === "PASS") phrase = "passes";
  if (move.kind === "REJECTED") phrase = `move rejected — ${move.reason ?? "reason"}`;
  if (move.kind === "DEFAULTED") phrase = `defaulted — ${move.reason ?? "request failed"}`;
  const isFail = move.kind === "REJECTED" || move.kind === "DEFAULTED";

  return (
    <div className={"bz-anim-slideup" + (isLatest ? " is-latest" : "")}>
      <div className={"bz-tline" + (isLatest ? " is-latest" : "")} onClick={onClick} style={{ "--p": color }}>
        <span className="bz-mono bz-dim bz-tline-rt">r{move.round}·t{move.turnIdx}</span>
        <span className="bz-tline-rule" style={{ backgroundColor: color }} aria-hidden="true"></span>
        <div className="bz-tline-body">
          <div className="bz-tline-top">
            <span className="bz-h3 bz-tline-who" style={{ color }}>{name}</span>
            <span className={"bz-kind" + (isFail ? " is-fail" : "")}>{move.kind}</span>
          </div>
          <span className={"bz-tline-phrase" + (isFail ? " bz-timeout" : " bz-sec")}>{phrase}</span>
          {move.requestId !== undefined && (
            <div className="bz-label-xs bz-tline-meta">req <span className="bz-sec">{shortId(move.requestId)}</span> · 3 validators</div>
          )}
        </div>
        <span className="bz-label-xs bz-tline-caret">{expanded ? "▾" : "▸"}</span>
      </div>
      {expanded && <TraceWaterfall move={move} />}
    </div>
  );
}

/* ============================== NegotiationStream ============================== */
function NegotiationStream({ moves, agentById }) {
  const [view, setView] = useState("transcript");
  const [expanded, setExpanded] = useState(new Set());
  const bodyRef = React.useRef(null);
  const toggle = (i) => setExpanded((prev) => {
    const next = new Set(prev);
    next.has(i) ? next.delete(i) : next.add(i);
    return next;
  });

  // Feed scrolls as moves land — terminal rhythm, no scrollIntoView.
  React.useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [moves.length, view]);

  return (
    <section className="bz-panel bz-negotiation">
      <header className="bz-negotiation-head">
        <h3 className="bz-h2">Negotiation</h3>
        <div className="bz-seg">
          <button className={view === "transcript" ? "is-active" : ""} onClick={() => setView("transcript")}>transcript</button>
          <button className={view === "orderbook" ? "is-active" : ""} onClick={() => setView("orderbook")}>order book</button>
        </div>
      </header>
      <div className="bz-negotiation-body" ref={bodyRef}>
        {moves.length === 0 && <div className="bz-empty bz-label-sm">waiting for the first move to land…</div>}

        {view === "transcript" && moves.map((m, i) => (
          <TranscriptLine key={i} move={m} agent={agentById.get(m.agentId.toString())}
            expanded={expanded.has(i)} onClick={() => toggle(i)} isLatest={i === moves.length - 1} />
        ))}

        {view === "orderbook" && (
          <div className="bz-mono bz-ob">
            <div className="bz-ob-head">
              <span>r·t</span><span>agent</span><span>action</span><span>lot</span><span>price</span>
            </div>
            {moves.map((m, i) => {
              const p = parseMove(m.raw);
              const isReject = m.kind === "REJECTED" || m.kind === "DEFAULTED";
              return (
                <div key={i}>
                  <div className={"bz-ob-row" + (isReject ? " bz-timeout" : "")} onClick={() => toggle(i)}>
                    <span>{m.round}·{m.turnIdx}</span>
                    <span>{agentById.get(m.agentId.toString())?.name ?? `#${m.agentId}`}</span>
                    <span>{m.kind}</span>
                    <span>{p.lot ?? "—"}</span>
                    <span>{p.price ?? (m.reason ? "✗" : "—")}</span>
                  </div>
                  {expanded.has(i) && <TraceWaterfall move={m} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

/* ============================== MiniLadder ============================== */
function MiniLadder({ limit = 6, onPick }) {
  const ranked = [...AGENTS].sort((a, b) => b.elo - a.elo).slice(0, limit);
  return (
    <ol className="bz-miniladder">
      {ranked.map((a, i) => (
        <li key={a.id.toString()} className="bz-miniladder-row" onClick={() => onPick && onPick(a)}>
          <span className="bz-mono bz-dim bz-mlrank">{i + 1}</span>
          <SigilTile name={a.name} size={28} />
          <span className="bz-h3 bz-truncate bz-flex1">{a.name}</span>
          <span className="bz-mono bz-sec">{a.elo}</span>
        </li>
      ))}
    </ol>
  );
}

Object.assign(window, {
  AppShell, AgentPanel, LotCard, TraceWaterfall, TranscriptLine,
  NegotiationStream, MiniLadder, parseMove, shortId,
  LiveMatchPreview, TickerLine, personaColorOf, CountUp,
});
