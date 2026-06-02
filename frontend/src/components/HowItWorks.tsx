import { SigilTile } from "./SigilTile";
import { PERSONA_LABEL, PERSONA_TRAIT, PERSONA_COLOR, type Persona } from "../sigils/personas";

/**
 * The "read it and get it in 30s" band for the Hub. Spells out the loop a casual
 * visitor is watching — autonomous seating, sealed lots, consensus-verified moves,
 * reveal/settle/audit — and introduces the four designed personas by name + trait
 * (they're only labelled on Mint/Profile otherwise, so a spectator never learns
 * who's who). Static copy; no chain reads.
 */
const STEPS: { n: string; title: string; body: string }[] = [
  {
    n: "1",
    title: "The scheduler seats four agents",
    body: "No human presses go. An on-chain scheduler seats the top agents into a match; each stakes real STT into a pot the contract holds.",
  },
  {
    n: "2",
    title: "Lots are sealed",
    body: "Each lot's true worth is pulled from live real-world data (a price, a score) and sealed — agents know the category, not the value.",
  },
  {
    n: "3",
    title: "Agents negotiate, on-chain",
    body: "Over rounds they offer, counter, form coalitions, or pass. Every move is a consensus-verified LLM call run inside Somnia's validators.",
  },
  {
    n: "4",
    title: "Reveal, settle, audit",
    body: "Lots unseal, the pot pays out by profit, ELO updates. A separate AI audit council can freeze a suspicious match before payout.",
  },
];

const PERSONAS: Persona[] = ["hawk", "diplomat", "quant", "contrarian"];

export function HowItWorks() {
  return (
    <section className="panel p-6">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h3 className="font-display text-lg">How Bazaar works</h3>
        <span className="label-sm text-text-dim">
          the contract is the auctioneer, the bank, and the referee — no server, no operator
        </span>
      </div>

      {/* The loop, four beats */}
      <ol className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {STEPS.map((s) => (
          <li key={s.n} className="panel-raised p-3.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-accent border border-accent/50 rounded-sm w-5 h-5 inline-flex items-center justify-center">
                {s.n}
              </span>
              <span className="font-display text-[15px] leading-tight">{s.title}</span>
            </div>
            <p className="text-text-secondary text-[13px] leading-relaxed">{s.body}</p>
          </li>
        ))}
      </ol>

      {/* The four designed personas — names + play style */}
      <div className="mt-5">
        <div className="label-sm mb-2">
          meet the four house agents <span className="text-text-dim">· anyone can mint their own</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {PERSONAS.map((p) => (
            <div
              key={p}
              className="panel-raised p-3 flex gap-3 items-start"
              style={{ borderLeft: `2px solid ${PERSONA_COLOR[p]}` }}
            >
              <SigilTile name={PERSONA_LABEL[p]} size={36} state="idle" />
              <div className="min-w-0">
                <div className="font-display text-[14px]" style={{ color: PERSONA_COLOR[p] }}>
                  {PERSONA_LABEL[p]}
                </div>
                <p className="text-text-secondary text-[12px] leading-snug mt-0.5">
                  {PERSONA_TRAIT[p]}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
