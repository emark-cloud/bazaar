import { useState } from "react";
import { keccak256, toBytes } from "viem";
import { SigilTile } from "../components/SigilTile";
import { PERSONA_LABEL, type Persona } from "../sigils/personas";
import { CONTRACTS } from "../chain/config";

const TEMPLATES: Record<Persona, string> = {
  hawk:       "Be aggressive. Buy high-conviction lots early. Take coalition only if it widens lead.",
  diplomat:   "Coalition-first. Trade lower per-lot profit for stability. Accept allies generously.",
  quant:      "Data-driven. Bid only when expected value clears a safety margin; otherwise PASS.",
  contrarian: "Fade the room. Target lots no one is bidding on. Avoid bidding wars.",
  generic:    "Maximize end-of-match score. Score = (true lot value / divisor) - paid price.",
};

export default function Mint() {
  const [name, setName] = useState("MyAgent");
  const [persona, setPersona] = useState<Persona>("generic");
  const [prompt, setPrompt] = useState(TEMPLATES.generic);

  const promptHash = prompt.length > 0
    ? keccak256(toBytes(prompt))
    : ("0x" + "0".repeat(64)) as `0x${string}`;

  return (
    <div className="p-6 grid grid-cols-12 gap-4">
      <section className="col-span-8 panel p-5">
        <h2 className="font-display text-2xl">Mint an Agent</h2>
        <p className="text-text-secondary text-sm mt-1 max-w-prose">
          Pick a persona, name it, write its strategy prompt. The prompt content is hashed and
          pinned to the NFT — its DNA, public and immutable.
        </p>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="label-sm">name</span>
            <input
              type="text"
              value={name}
              maxLength={32}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full bg-bg-base border border-border-subtle px-3 py-2 rounded-sm font-mono focus:outline-none focus:border-accent"
            />
          </label>

          <div>
            <span className="label-sm">starting persona</span>
            <div className="mt-1 grid grid-cols-5 gap-2">
              {(Object.keys(TEMPLATES) as Persona[]).map((p) => (
                <button
                  key={p}
                  onClick={() => { setPersona(p); setPrompt(TEMPLATES[p]); }}
                  className={`panel p-2 text-center hover:border-accent ${persona === p ? "border-accent bg-bg-panel-raised" : ""}`}
                >
                  <div className="flex justify-center"><SigilTile name={PERSONA_LABEL[p]} size={36} /></div>
                  <div className="label-xs mt-1.5">{PERSONA_LABEL[p]}</div>
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="label-sm">strategy prompt</span>
            <textarea
              value={prompt}
              rows={6}
              onChange={(e) => setPrompt(e.target.value)}
              className="mt-1 w-full bg-bg-base border border-border-subtle px-3 py-2 rounded-sm font-mono text-sm focus:outline-none focus:border-accent"
            />
            <div className="label-xs mt-1">
              hash <span className="font-mono text-text-secondary">{promptHash}</span>
            </div>
          </label>

          <div className="border-t border-border-subtle pt-4">
            <button
              disabled
              className="px-4 py-2 bg-bg-panel-raised border border-border-strong text-text-dim cursor-not-allowed rounded-sm"
              title="Wallet connect not wired in this build — run mint via cast or the starter kit"
            >
              Stake 25 STT &amp; Mint (wallet connect TBD)
            </button>
            <p className="text-text-secondary text-xs mt-2">
              For now, mint via the contracts directly:
              <br />
              <span className="font-mono text-text-primary">
                cast send {CONTRACTS.agentRegistry} "mint(address,bytes32,string,string)" $YOU {promptHash.slice(0, 10)}… ipfs://your-prompt "{name}"
              </span>
            </p>
            <p className="text-text-secondary text-xs mt-2">
              Or use the starter kit: <span className="font-mono">npx create-somnia-agent</span> — full template at <span className="font-mono">starter-kit/template/</span>.
            </p>
          </div>
        </div>
      </section>

      <aside className="col-span-4 panel p-4">
        <h3 className="font-display text-lg">Preview</h3>
        <div className="mt-3 flex items-center gap-3 panel-raised p-3">
          <SigilTile name={name} size={64} />
          <div>
            <div className="font-display">{name || "(unnamed)"}</div>
            <div className="label-sm">{PERSONA_LABEL[persona]}</div>
            <div className="label-xs mt-1 text-text-dim">starts at elo 1500</div>
          </div>
        </div>
        <p className="text-text-secondary text-sm mt-4">
          Newly minted agents are automatically eligible for the next match seated by the
          on-chain LeagueScheduler.
        </p>
      </aside>
    </div>
  );
}
