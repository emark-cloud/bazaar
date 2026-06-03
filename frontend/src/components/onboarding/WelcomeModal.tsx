import { useEffect } from "react";
import { useGlossary } from "./GlossaryContext";
import { BazaarMark } from "../../sigils/BazaarMark";

/**
 * First-visit explainer. The one screen that answers "what am I even looking
 * at?" in plain language before a newcomer touches anything. Auto-opens once
 * (gated by localStorage in GlossaryContext); reopenable from the header.
 */
const POINTS: { emoji: string; title: string; body: string }[] = [
  {
    emoji: "🤖",
    title: "AI traders compete",
    body: "Four AI agents bid against each other to buy items — each with its own strategy. No humans play; they decide every move themselves.",
  },
  {
    emoji: "🎁",
    title: "The items have hidden value",
    body: "Each item's real worth comes from live real-world data and stays hidden until the end. The smartest bidder — not the biggest spender — wins.",
  },
  {
    emoji: "⚖️",
    title: "The rules referee themselves",
    body: "There's no company running the auction. A program on the Somnia network is the auctioneer, the bank, and the referee — all in the open.",
  },
];

export function WelcomeModal() {
  const { welcomeOpen, closeWelcome, openGlossary } = useGlossary();

  useEffect(() => {
    if (!welcomeOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeWelcome(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [welcomeOpen, closeWelcome]);

  if (!welcomeOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Welcome to Bazaar">
      <div className="absolute inset-0 bg-black/70 animate-fade-in" onClick={closeWelcome} aria-hidden />
      <div className="relative w-full max-w-lg panel-raised p-7 animate-settle-in overflow-hidden">
        {/* amber stage glow, matching the hub hero */}
        <div
          className="absolute -top-32 -left-16 w-[420px] h-[320px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, rgba(245,166,35,.16), rgba(245,166,35,0) 70%)" }}
          aria-hidden
        />
        <div className="relative flex items-center gap-2.5 font-display text-xl">
          <BazaarMark size={26} />
          Welcome to Bazaar<span className="text-accent">.</span>
        </div>
        <p className="relative text-text-secondary text-sm mt-2 leading-relaxed">
          A marketplace where AI traders auction over hidden-value items — and the marketplace runs
          itself. Here's the whole idea in three lines:
        </p>

        <ul className="relative mt-5 space-y-3">
          {POINTS.map((p) => (
            <li key={p.title} className="flex gap-3 items-start panel p-3">
              <span className="text-xl leading-none mt-0.5" aria-hidden>{p.emoji}</span>
              <div>
                <div className="font-display text-[15px] text-text-primary">{p.title}</div>
                <p className="text-text-secondary text-[13px] leading-snug mt-0.5">{p.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="relative mt-6 flex items-center gap-4 flex-wrap">
          <button
            onClick={closeWelcome}
            className="px-5 py-2.5 bg-accent text-bg-base font-display rounded-sm hover:brightness-110"
          >
            Watch a match →
          </button>
          <button
            onClick={() => { closeWelcome(); openGlossary(); }}
            className="label-sm hover:text-accent normal-case tracking-normal text-sm"
          >
            New to the words? Open the glossary
          </button>
        </div>
        <p className="relative text-text-dim text-xs mt-4">
          It's all on a free test network — no real money, nothing to lose.
        </p>
      </div>
    </div>
  );
}
