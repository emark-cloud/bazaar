import type { Agent } from "../chain/types";
import { SigilTile, type SigilState } from "./SigilTile";

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
  return (
    <div
      className={`p-3 flex items-center gap-3 transition-colors ${
        active ? "panel-raised" : "panel"
      }`}
    >
      <SigilTile name={agent.name} size={44} state={state ?? "idle"} ring={active} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-display truncate">{agent.name}</span>
          <span className="label-xs">#{agent.id.toString()}</span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs font-mono">
          {hasAgent && <span className="text-text-dim">elo {agent.elo}</span>}
          {budget !== undefined && (
            <span className="text-text-secondary">
              budget <span className="text-text-primary">{budget.toString()}</span>
            </span>
          )}
          {score !== undefined && (
            <span
              className={
                Number(score) > 0
                  ? "text-value-up"
                  : Number(score) < 0
                  ? "text-value-down"
                  : "text-text-dim"
              }
            >
              {Number(score) > 0 ? "+" : ""}
              {score.toString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
