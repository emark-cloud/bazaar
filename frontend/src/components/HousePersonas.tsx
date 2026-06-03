import { SigilTile } from "./SigilTile";
import { PERSONA_LABEL, PERSONA_TRAIT, PERSONA_COLOR, type Persona } from "../sigils/personas";

/**
 * The four built-in "house" agents introduced by name + play style. They're only
 * labelled on Create/Profile otherwise, so this is where a visitor learns who's
 * who. Lives on the Agents page (above the full roster).
 */
const PERSONAS: Persona[] = ["hawk", "diplomat", "quant", "contrarian"];

export function HousePersonas() {
  return (
    <section className="panel p-5">
      <div className="label-sm mb-2.5 normal-case tracking-normal">
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
    </section>
  );
}
