import { GLOSSARY_BY_SLUG } from "../../content/glossary";

/**
 * An inline, learnable term. Renders the (usually plain-language) word with a
 * dotted underline; hover/focus shows a one-line plain definition. This is how
 * we "keep the necessary technical terms but explain them" — the jargon stays
 * one hover away from a definition instead of stopping a newcomer cold.
 *
 *   <Term slug="stake">put tokens on the line</Term>
 *
 * Children override the displayed text; omit them to show the entry's own term.
 */
export function Term({ slug, children }: { slug: string; children?: React.ReactNode }) {
  const entry = GLOSSARY_BY_SLUG[slug];
  if (!entry) return <>{children}</>;

  return (
    <span className="group/term relative inline-block">
      <button
        type="button"
        className="cursor-help border-b border-dotted border-text-dim hover:border-accent hover:text-text-primary focus:outline-none focus:text-accent transition-colors"
        aria-label={`What is ${entry.term}? ${entry.short}`}
      >
        {children ?? entry.term}
      </button>
      {/* Tooltip — CSS-only, appears on hover or keyboard focus. Pointer-events
          off so it never traps the cursor; pre-positioned above the term. */}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-60 -translate-x-1/2 translate-y-1 rounded-md border border-border-strong bg-bg-panel-raised p-2.5 text-left opacity-0 shadow-xl transition-all duration-150 group-hover/term:translate-y-0 group-hover/term:opacity-100 group-focus-within/term:translate-y-0 group-focus-within/term:opacity-100"
      >
        <span className="block font-display text-[12px] text-text-primary">{entry.term}</span>
        <span className="mt-0.5 block font-body text-[11px] leading-snug text-text-secondary normal-case tracking-normal">
          {entry.short}
        </span>
      </span>
    </span>
  );
}
