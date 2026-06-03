import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * App-wide onboarding state: the Glossary panel (optionally scrolled to a term)
 * and the first-visit Welcome modal. Kept in one tiny context so any component —
 * a <Term> deep in the transcript, a help button in the header — can open either
 * without prop-drilling.
 */
const WELCOME_KEY = "bazaar.welcomed.v1";

interface GlossaryState {
  /** slug to scroll/highlight, or "" for the top of the panel; null = closed */
  openSlug: string | null;
  openGlossary: (slug?: string) => void;
  closeGlossary: () => void;
  welcomeOpen: boolean;
  openWelcome: () => void;
  closeWelcome: () => void;
}

const Ctx = createContext<GlossaryState | null>(null);

export function GlossaryProvider({ children }: { children: ReactNode }) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  // Show the welcome explainer once, on a visitor's first ever load. Wrapped in
  // try/catch so private-mode / disabled storage never breaks the app — worst
  // case the explainer just doesn't auto-open.
  useEffect(() => {
    try {
      if (!localStorage.getItem(WELCOME_KEY)) setWelcomeOpen(true);
    } catch { /* storage unavailable — skip auto-open */ }
  }, []);

  const openGlossary = useCallback((slug?: string) => setOpenSlug(slug ?? ""), []);
  const closeGlossary = useCallback(() => setOpenSlug(null), []);
  const openWelcome = useCallback(() => setWelcomeOpen(true), []);
  const closeWelcome = useCallback(() => {
    setWelcomeOpen(false);
    try { localStorage.setItem(WELCOME_KEY, "1"); } catch { /* ignore */ }
  }, []);

  return (
    <Ctx.Provider value={{ openSlug, openGlossary, closeGlossary, welcomeOpen, openWelcome, closeWelcome }}>
      {children}
    </Ctx.Provider>
  );
}

export function useGlossary(): GlossaryState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGlossary must be used inside <GlossaryProvider>");
  return v;
}
