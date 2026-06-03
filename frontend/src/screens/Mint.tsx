import { useEffect, useState } from "react";
import { keccak256, toBytes } from "viem";
import { SigilTile, type SigilState } from "../components/SigilTile";
import { PERSONA_LABEL, PERSONA_TRAIT, personaColorOf, type Persona } from "../sigils/personas";
import { CONTRACTS } from "../chain/config";
import { AGENT_REGISTRY_ABI } from "../chain/abis";
import { publicClient } from "../chain/client";
import { useInjectedWallet } from "../chain/wallet";
import { Term } from "../components/onboarding/Term";
import { shortAddr } from "../lib/format";

const TEMPLATES: Record<Persona, string> = {
  hawk:       "Be aggressive. Buy high-conviction lots early. Take coalition only if it widens lead.",
  diplomat:   "Coalition-first. Trade lower per-lot profit for stability. Accept allies generously.",
  quant:      "Data-driven. Bid only when expected value clears a safety margin; otherwise PASS.",
  contrarian: "Fade the room. Target lots no one is bidding on. Avoid bidding wars.",
  generic:    "Maximize end-of-match score. Score = (true lot value / divisor) - paid price.",
};

const EXPLORER_TX = "https://shannon-explorer.somnia.network/tx";

type MintStatus =
  | { kind: "idle" }
  | { kind: "signing" }
  | { kind: "pending"; hash: `0x${string}` }
  | { kind: "done"; hash: `0x${string}` }
  | { kind: "error"; message: string };

export default function Mint() {
  const [name, setName] = useState("MyAgent");
  const [nameTouched, setNameTouched] = useState(false);
  const [persona, setPersona] = useState<Persona>("generic");
  const [prompt, setPrompt] = useState(TEMPLATES.generic);
  const [status, setStatus] = useState<MintStatus>({ kind: "idle" });
  // Bumped on every prompt edit so the preview sigil re-strikes (combined with persona).
  const [editCount, setEditCount] = useState(0);
  const [sigilState, setSigilState] = useState<SigilState>("idle");

  const wallet = useInjectedWallet();

  // The preview sigil "strikes" the moment the persona changes or the prompt is
  // edited, then settles back to its idle pulse.
  useEffect(() => {
    setSigilState("acting");
    const t = setTimeout(() => setSigilState("idle"), 420);
    return () => clearTimeout(t);
  }, [persona, editCount]);

  // Selecting a persona swaps the template and auto-fills the name — unless the
  // user has typed their own.
  function choosePersona(p: Persona) {
    setPersona(p);
    setPrompt(TEMPLATES[p]);
    if (!nameTouched) setName(PERSONA_LABEL[p].replace(/^The /, ""));
  }

  // Canonical persona label drives the preview sigil/color (resolves via the
  // nameToPersona "The …" strip); the user's name overrides only the display.
  const previewName = name.trim() || PERSONA_LABEL[persona];
  const personaColor = personaColorOf(PERSONA_LABEL[persona]);

  const promptHash = (prompt.length > 0
    ? keccak256(toBytes(prompt))
    : "0x" + "0".repeat(64)) as `0x${string}`;

  // Pinning the prompt to IPFS/Arweave is a separate (deferred) step; the hash is
  // the on-chain commitment, so a placeholder URI keyed by the hash is honest here.
  const promptURI = `ipfs://bazaar/${promptHash.slice(2, 18)}`;

  async function handleMint() {
    if (!wallet.address) {
      await wallet.connect();
      return;
    }
    const client = wallet.getClient();
    if (!client) {
      setStatus({ kind: "error", message: "Wallet client unavailable." });
      return;
    }
    setStatus({ kind: "signing" });
    try {
      // Somnia meters gas far higher than a standard EVM (~3M for a mint vs ~170k
      // a local replay shows), and injected wallets under-estimate it — a default
      // 2M limit runs out of gas mid-execution. Estimate against our own RPC and
      // pass an explicit limit with headroom so the wallet doesn't guess.
      let gas: bigint;
      try {
        const est = await publicClient.estimateContractGas({
          address: CONTRACTS.agentRegistry as `0x${string}`,
          abi: AGENT_REGISTRY_ABI,
          functionName: "mint",
          args: [wallet.address, promptHash, promptURI, name],
          account: wallet.address,
        });
        gas = (est * 13n) / 10n; // +30% headroom
      } catch {
        gas = 4_500_000n; // generous fallback if estimation is unavailable
      }
      const hash = await client.writeContract({
        address: CONTRACTS.agentRegistry as `0x${string}`,
        abi: AGENT_REGISTRY_ABI,
        functionName: "mint",
        args: [wallet.address, promptHash, promptURI, name],
        account: wallet.address,
        chain: undefined,
        gas,
      });
      setStatus({ kind: "pending", hash });
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus({ kind: "done", hash });
    } catch (err: unknown) {
      const message = (err as { shortMessage?: string; message?: string })?.shortMessage
        ?? (err as { message?: string })?.message
        ?? "Mint transaction failed.";
      setStatus({ kind: "error", message });
    }
  }

  const busy = status.kind === "signing" || status.kind === "pending";
  const buttonLabel = !wallet.address
    ? (wallet.connecting ? "Connecting…" : "Connect Wallet")
    : status.kind === "signing" ? "Confirm in wallet…"
    : status.kind === "pending" ? "Creating…"
    : "Create Agent";

  return (
    <div className="p-6 grid grid-cols-12 gap-4">
      <section className="col-span-8 panel p-5">
        <h2 className="font-display text-2xl">Create an Agent</h2>
        <p className="text-text-secondary text-sm mt-1 max-w-prose">
          Pick a starting style, name it, and write its strategy in plain words. When you{" "}
          <Term slug="mint">create</Term> the agent, that strategy is locked in — public, and
          impossible to secretly change later. You own it.
        </p>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="label-sm">name</span>
            <input
              type="text"
              value={name}
              maxLength={32}
              onChange={(e) => { setName(e.target.value); setNameTouched(true); }}
              className="mt-1 w-full bg-bg-base border border-border-subtle px-3 py-2 rounded-sm font-mono focus:outline-none focus:border-accent"
            />
          </label>

          <div>
            <span className="label-sm">starting style</span>
            <div className="mt-1 grid grid-cols-5 gap-2">
              {(Object.keys(TEMPLATES) as Persona[]).map((p) => {
                const pColor = personaColorOf(PERSONA_LABEL[p]);
                const selected = persona === p;
                return (
                  <button
                    key={p}
                    onClick={() => choosePersona(p)}
                    className="panel p-2 text-center transition-all hover:border-border-strong"
                    style={{
                      borderTop: `2px solid ${pColor}`,
                      ...(selected
                        ? {
                            borderColor: pColor,
                            backgroundColor: "#1C1F24",
                            boxShadow: `0 0 0 1px ${pColor}, 0 6px 20px -12px ${pColor}`,
                          }
                        : {}),
                    }}
                  >
                    <div className="flex justify-center">
                      <SigilTile name={PERSONA_LABEL[p]} size={36} state={selected ? "thinking" : "idle"} />
                    </div>
                    <div className="label-xs mt-1.5">{PERSONA_LABEL[p]}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block">
            <span className="label-sm">strategy <span className="text-text-dim">— tell it how to play, in plain words</span></span>
            <textarea
              value={prompt}
              rows={6}
              onChange={(e) => { setPrompt(e.target.value); setEditCount((n) => n + 1); }}
              className="mt-1 w-full bg-bg-base border border-border-subtle px-3 py-2 rounded-sm font-mono text-sm focus:outline-none focus:border-accent"
            />
            <div className="label-xs mt-1" title="A unique fingerprint of your strategy text. It proves the strategy can't be quietly edited after you create the agent.">
              fingerprint <span className="font-mono text-text-secondary">{promptHash}</span>
            </div>
          </label>

          <div className="border-t border-border-subtle pt-4">
            <div className="flex items-center gap-3">
              <button
                onClick={handleMint}
                disabled={busy}
                className={`px-4 py-2 rounded-sm border ${
                  busy
                    ? "bg-bg-panel-raised border-border-strong text-text-dim cursor-wait"
                    : "bg-accent border-accent text-bg-base font-display hover:brightness-110"
                }`}
              >
                {buttonLabel}
              </button>
              {wallet.address && (
                <span className="label-xs text-text-secondary">
                  connected <span className="font-mono text-text-primary">{shortAddr(wallet.address)}</span>
                </span>
              )}
            </div>

            {!wallet.hasProvider && (
              <p className="text-status-timeout text-xs mt-2">
                No crypto wallet found. Install MetaMask, or create an agent from the command line below.
              </p>
            )}
            {status.kind === "error" && (
              <p className="text-value-down text-xs mt-2">{status.message}</p>
            )}
            {wallet.error && status.kind !== "error" && (
              <p className="text-value-down text-xs mt-2">{wallet.error}</p>
            )}
            {(status.kind === "pending" || status.kind === "done") && (
              <p className="text-xs mt-2">
                <span className={status.kind === "done" ? "text-value-up" : "text-status-pending"}>
                  {status.kind === "done" ? "✓ created" : "⌛ pending"}
                </span>{" "}
                <a
                  href={`${EXPLORER_TX}/${status.hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-text-secondary hover:text-accent"
                >
                  {status.hash.slice(0, 12)}…
                </a>
                {status.kind === "done" && (
                  <span className="text-text-secondary"> — your agent is ready. The match-maker can now seat it into matches.</span>
                )}
              </p>
            )}

            <p className="text-text-dim text-xs mt-3">
              Creating your agent registers it as a collectible you own. A 25 STT entry is{" "}
              <Term slug="escrow">held safely</Term> by the program when the{" "}
              <Term slug="scheduler">match-maker</Term> seats it into a match.
            </p>
            <p className="text-text-secondary text-xs mt-2">
              Prefer the command line? Create it directly:
              <br />
              <span className="font-mono text-text-primary">
                cast send {CONTRACTS.agentRegistry} "mint(address,bytes32,string,string)" $YOU {promptHash.slice(0, 10)}… {promptURI} "{name}"
              </span>
            </p>
            <p className="text-text-secondary text-xs mt-2">
              Or scaffold locally: <span className="font-mono">npx create-somnia-agent</span> — full template at <span className="font-mono">starter-kit/template/</span>.
            </p>
          </div>
        </div>
      </section>

      <aside className="col-span-4 panel p-4 self-start">
        <h3 className="font-display text-lg">Preview</h3>
        <div
          className="mt-3 flex items-center gap-3.5 panel-raised p-3.5 relative overflow-hidden"
          style={{ borderTop: `2px solid ${personaColor}` }}
        >
          {/* radial persona glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(ellipse at 18% 30%, color-mix(in srgb, ${personaColor} 22%, transparent), transparent 62%)` }}
            aria-hidden
          />
          {/* key remounts the tile on persona/prompt change → the sigil "strikes" */}
          <div className="relative">
            <SigilTile key={`${persona}·${editCount}`} name={previewName} size={72} state={sigilState} ring />
          </div>
          <div className="relative min-w-0">
            <div className="font-display text-lg truncate">{name || "(unnamed)"}</div>
            <div className="label-sm" style={{ color: personaColor }}>{PERSONA_LABEL[persona]}</div>
            <div className="label-xs mt-1 text-text-dim">starts at rating 1500</div>
          </div>
        </div>

        <div className="mt-3.5 pt-3.5 border-t border-border-subtle">
          <span className="label-xs">how it'll play</span>
          <p className="text-text-secondary text-[13px] mt-1.5 leading-relaxed">{PERSONA_TRAIT[persona]}</p>
        </div>

        <p className="text-text-secondary text-sm mt-3.5">
          New agents are automatically eligible for the next match the{" "}
          <Term slug="scheduler">match-maker</Term> starts.
        </p>
      </aside>
    </div>
  );
}
