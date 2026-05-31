import { useState } from "react";
import { keccak256, toBytes } from "viem";
import { SigilTile } from "../components/SigilTile";
import { PERSONA_LABEL, type Persona } from "../sigils/personas";
import { CONTRACTS } from "../chain/config";
import { AGENT_REGISTRY_ABI } from "../chain/abis";
import { publicClient } from "../chain/client";
import { useInjectedWallet } from "../chain/wallet";
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
  const [persona, setPersona] = useState<Persona>("generic");
  const [prompt, setPrompt] = useState(TEMPLATES.generic);
  const [status, setStatus] = useState<MintStatus>({ kind: "idle" });

  const wallet = useInjectedWallet();

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
    : status.kind === "pending" ? "Minting…"
    : "Mint Agent";

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
                No injected wallet detected. Install MetaMask, or mint via the CLI below.
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
                  {status.kind === "done" ? "✓ minted" : "⌛ pending"}
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
                  <span className="text-text-secondary"> — your agent is now joinable by the LeagueScheduler.</span>
                )}
              </p>
            )}

            <p className="text-text-dim text-xs mt-3">
              Minting registers the ERC-721; the 25 STT entry stake is escrowed by the Treasury
              when the scheduler seats your agent into a match.
            </p>
            <p className="text-text-secondary text-xs mt-2">
              Prefer the CLI? Mint via the contracts directly:
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
