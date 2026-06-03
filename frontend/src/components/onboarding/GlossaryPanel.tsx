import { useEffect, useRef } from "react";
import { useGlossary } from "./GlossaryContext";
import { GLOSSARY, GLOSSARY_GROUPS } from "../../content/glossary";

/**
 * The full plain-language glossary, as a right-side slide-over. Opened from the
 * header "Help" button or from any <Term> click (which scrolls to and briefly
 * highlights its entry). Closes on Escape, backdrop click, or the × button.
 */
export function GlossaryPanel() {
  const { openSlug, closeGlossary } = useGlossary();
  const open = openSlug !== null;
  const bodyRef = useRef<HTMLDivElement>(null);

  // Escape closes; lock background scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeGlossary(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, closeGlossary]);

  // When opened with a specific term, scroll it into view inside the panel.
  useEffect(() => {
    if (!openSlug) return;
    const el = bodyRef.current?.querySelector(`[data-slug="${openSlug}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [openSlug]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label="Glossary">
      <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={closeGlossary} aria-hidden />
      <aside className="relative w-full max-w-md h-full bg-bg-panel border-l border-border-strong flex flex-col shadow-2xl animate-slide-up-in">
        <header className="flex items-center justify-between px-5 h-14 border-b border-border-subtle shrink-0">
          <div>
            <h2 className="font-display text-lg leading-none">Plain-English glossary</h2>
            <p className="label-xs mt-1 normal-case tracking-normal text-text-dim">every term, explained simply</p>
          </div>
          <button
            onClick={closeGlossary}
            className="w-8 h-8 flex items-center justify-center rounded-md text-text-secondary hover:bg-bg-panel-raised hover:text-text-primary"
            aria-label="Close glossary"
          >✕</button>
        </header>

        <div ref={bodyRef} className="flex-1 overflow-y-auto p-5 space-y-6">
          {GLOSSARY_GROUPS.map((g) => (
            <section key={g.key}>
              <h3 className="label-sm text-accent mb-2">{g.title}</h3>
              <dl className="space-y-3">
                {GLOSSARY.filter((e) => e.group === g.key).map((e) => (
                  <div
                    key={e.slug}
                    data-slug={e.slug}
                    className={`panel-raised p-3 transition-colors ${openSlug === e.slug ? "border-accent" : ""}`}
                  >
                    <dt className="font-display text-[15px] text-text-primary flex items-baseline gap-2 flex-wrap">
                      {e.term}
                      {e.also && (
                        <span className="font-mono text-[10px] text-text-dim normal-case">
                          aka {e.also}
                        </span>
                      )}
                    </dt>
                    <dd className="text-text-secondary text-[13px] leading-relaxed mt-1">
                      {e.long ?? e.short}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          <p className="text-text-dim text-xs leading-relaxed pt-2">
            Bazaar runs on Somnia's Shannon test network. Everything here uses free test tokens —
            nothing costs real money.
          </p>
        </div>
      </aside>
    </div>
  );
}
