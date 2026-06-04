import type { CSSProperties } from "react";
import type { Agent } from "../chain/types";
import { SigilTile, type SigilState } from "./SigilTile";
import { personaColorOf, nameToPersona, PERSONA_LABEL } from "../sigils/personas";
import { formatBudget, sttScale } from "../lib/format";
import { CountUp } from "./CountUp";

export function AgentPanel({
  agent,
  budget,
  score,
  active,
  state,
}: {
  agent: Agent | { name: string; id: bigint };
  budget?: bigint;
  score?: bigint | number;
  active?: boolean;
  state?: SigilState;
}) {
  const hasAgent = "elo" in agent;
  const isWinner = state === "victory";
  // Score is `worth − paidPrice` in the match's budget unit (STT-int for exhibition, wei for
  // real-stakes). sttScale collapses wei-scale magnitudes to STT so the panel never shows a raw 1e19.
  const scoreNum =
    score === undefined ? undefined : sttScale(typeof score === "bigint" ? score : BigInt(Math.trunc(score)));

  // The agent's identity color drives the left rule (--p); amber chrome handles
  // turn/winner emphasis. Persona color is identity only — never a fill.
  const pColor = personaColorOf(agent.name);

  // Archetype label ("The Hawk" …) so a spectator knows this is a designed
  // persona, not a random name. User-minted agents resolve to generic → omit.
  const persona = nameToPersona(agent.name);
  const personaLabel = persona === "generic" ? null : PERSONA_LABEL[persona];

  // Active turn: inset amber 1px ring + soft amber outer glow.
  // Winner: solid amber ring + breathing winner-glow (own keyframe).
  const style: CSSProperties = {
    borderLeft: `2px solid ${pColor}`,
    ...(active && !isWinner
      ? { boxShadow: "inset 0 0 0 1px rgba(245,166,35,.55), 0 0 22px -8px #F5A623" }
      : {}),
  };

  return (
    <div
      className={`p-3 flex items-center gap-3 transition-[background,border-color,box-shadow] duration-300 relative ${
        isWinner ? "panel-raised border-accent animate-winner-glow" : active ? "panel-raised" : "panel"
      }`}
      style={style}
    >
      <SigilTile name={agent.name} size={44} state={state ?? "idle"} ring={active || isWinner} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-display truncate">{agent.name}</span>
          {isWinner ? (
            <span className="text-accent text-[15px] leading-none" title="match winner">♛</span>
          ) : (
            <span className="label-xs">#{agent.id.toString()}</span>
          )}
        </div>
        {personaLabel && (
          <div className="label-xs mt-0.5" style={{ color: pColor }}>{personaLabel}</div>
        )}
        <div className="flex items-center gap-3 mt-1 text-xs font-mono">
          {active && !isWinner && (
            <span className="text-accent inline-flex items-center">
              thinking
              <span className="inline-flex gap-0.5 ml-1" aria-hidden>
                <i className="w-[3px] h-[3px] rounded-full bg-accent inline-block animate-thinking-dot" />
                <i className="w-[3px] h-[3px] rounded-full bg-accent inline-block animate-thinking-dot [animation-delay:.18s]" />
                <i className="w-[3px] h-[3px] rounded-full bg-accent inline-block animate-thinking-dot [animation-delay:.36s]" />
              </span>
            </span>
          )}
          {!active && hasAgent && <span className="text-text-dim">elo {agent.elo}</span>}
          {budget !== undefined && (
            <span className="text-text-secondary">
              budget <span className="text-text-primary">{formatBudget(budget)}</span>
              <span className="text-text-dim"> STT</span>
            </span>
          )}
          {scoreNum !== undefined && (
            <CountUp
              to={scoreNum}
              prefix={scoreNum > 0 ? "+" : ""}
              suffix=" STT"
              className={`font-semibold ${
                scoreNum > 0 ? "text-value-up" : scoreNum < 0 ? "text-value-down" : "text-text-dim"
              }`}
            />
          )}
        </div>
      </div>
    </div>
  );
}
