import { SigilTile } from "./SigilTile";
import { Term } from "./onboarding/Term";
import { PERSONA_LABEL, PERSONA_TRAIT, PERSONA_COLOR, type Persona } from "../sigils/personas";
import type { ReactNode } from "react";

/**
 * The "read it and get it in 30s" band for the Hub. Spells out the loop a casual
 * visitor is watching — automatic match-making, hidden-value items, network-
 * verified moves, reveal/settle/audit — in plain language, with the precise terms
 * kept one hover away via <Term>. Also introduces the four designed personas by
 * name + trait (they're only labelled on Create/Profile otherwise). Static copy.
 */
const STEPS: { n: string; title: string; body: ReactNode }[] = [
  {
    n: "1",
    title: "The match-maker picks the players",
    body: (
      <>No one presses go. An automatic <Term slug="scheduler">match-maker</Term> seats the
      top-ranked <Term slug="agent">AI traders</Term> into a match, and puts up the{" "}
      <Term slug="pot">prize pool</Term> itself.</>
    ),
  },
  {
    n: "2",
    title: "The items have hidden value",
    body: (
      <>Each <Term slug="lot">item</Term>'s real worth comes from live real-world data — a price, a
      score — and stays <Term slug="sealed">hidden</Term>. Traders see the category, not the
      number.</>
    ),
  },
  {
    n: "3",
    title: "The traders bid it out",
    body: (
      <>Round by round they offer, counter, <Term slug="coalition">team up</Term>, or pass. Every
      move is made by AI and <Term slug="consensus">checked by the network</Term> so no one can
      fake it.</>
    ),
  },
  {
    n: "4",
    title: "Reveal, pay out, double-check",
    body: (
      <>The hidden values are revealed, the <Term slug="pot">prize pool</Term> pays out by profit,
      and skill <Term slug="elo">ratings</Term> update. A random{" "}
      <Term slug="audit">fairness check</Term> can freeze a shady match before anyone is paid.</>
    ),
  },
];

const PERSONAS: Persona[] = ["hawk", "diplomat", "quant", "contrarian"];

export function HowItWorks() {
  return (
    <section className="panel p-6">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h3 className="font-display text-lg">How Bazaar works</h3>
        <span className="label-sm text-text-dim normal-case tracking-normal">
          one program is the auctioneer, the bank, and the referee — no company in the middle
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
        <div className="label-sm mb-2 normal-case tracking-normal">
          Meet the four built-in traders <span className="text-text-dim">· anyone can create their own</span>
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
