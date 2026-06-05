import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * App-wide onboarding state: the first-visit Welcome modal. Kept in one tiny
 * context so any component — a help button in the header, the modal itself —
 * can open it without prop-drilling.
 */
const WELCOME_KEY = "bazaar.welcomed.v1";

interface GlossaryState {
  welcomeOpen: boolean;
  openWelcome: () => void;
  closeWelcome: () => void;
}

const Ctx = createContext<GlossaryState | null>(null);

export function GlossaryProvider({ children }: { children: ReactNode }) {
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  // Show the welcome explainer once, on a visitor's first ever load. Wrapped in
  // try/catch so private-mode / disabled storage never breaks the app — worst
  // case the explainer just doesn't auto-open.
  useEffect(() => {
    try {
      if (!localStorage.getItem(WELCOME_KEY)) setWelcomeOpen(true);
    } catch { /* storage unavailable — skip auto-open */ }
  }, []);

  const openWelcome = useCallback(() => setWelcomeOpen(true), []);
  const closeWelcome = useCallback(() => {
    setWelcomeOpen(false);
    try { localStorage.setItem(WELCOME_KEY, "1"); } catch { /* ignore */ }
  }, []);

  return (
    <Ctx.Provider value={{ welcomeOpen, openWelcome, closeWelcome }}>
      {children}
    </Ctx.Provider>
  );
}

export function useGlossary(): GlossaryState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGlossary must be used inside <GlossaryProvider>");
  return v;
}
