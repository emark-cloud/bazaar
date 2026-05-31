/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "bg-base":          "#0B0C0E",
        "bg-panel":         "#141619",
        "bg-panel-raised":  "#1C1F24",
        "border-subtle":    "#262A30",
        "border-strong":    "#3A3F47",
        "text-primary":     "#F2F4F7",
        "text-secondary":   "#9AA0AA",
        "text-dim":         "#5C626C",
        accent:             "#F5A623",
        "accent-dim":       "#7A5616",
        "value-up":         "#3FB67A",
        "value-down":       "#E5484D",
        "status-pending":   "#5B8DEF",
        "status-timeout":   "#E5984D",
        // persona colors
        "p-hawk":           "#D6533C",
        "p-diplomat":       "#3C9D9B",
        "p-quant":          "#4A78C2",
        "p-contrarian":     "#8B7BB0",
      },
      fontFamily: {
        display: [
          '"Space Grotesk"',
          '"Suisse Intl"',
          "ui-sans-serif",
          "system-ui",
        ],
        body: ["Inter", "ui-sans-serif", "system-ui"],
        mono: [
          "JetBrains Mono",
          "IBM Plex Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      fontFeatureSettings: {
        tabular: '"tnum"',
      },
      keyframes: {
        "sigil-pulse": {
          "0%, 100%": { opacity: "0.8", transform: "scale(1)" },
          "50%":      { opacity: "1.0", transform: "scale(1.04)" },
        },
        "sigil-thinking": {
          "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
          "50%":      { transform: "translateY(-1px) rotate(2deg)" },
        },
        "sigil-strike": {
          "0%":   { transform: "scale(1)" },
          "30%":  { transform: "scale(1.15)" },
          "100%": { transform: "scale(1)" },
        },
        "slide-up-in": {
          "0%":  { opacity: "0", transform: "translateY(8px)" },
          "60%": { opacity: "1", transform: "translateY(-2px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "flash-once": {
          "0%, 100%": { backgroundColor: "rgba(245,166,35,0)" },
          "30%":      { backgroundColor: "rgba(245,166,35,0.18)" },
        },
        "live-dot": {
          "0%, 100%": { opacity: "0.4" },
          "50%":      { opacity: "1" },
        },
        // settlement lot reveal: sealed glyph flips on the X axis to its value
        "lot-flip": {
          "0%":   { transform: "rotateX(90deg)", opacity: "0" },
          "55%":  { transform: "rotateX(-12deg)", opacity: "1" },
          "100%": { transform: "rotateX(0deg)", opacity: "1" },
        },
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "sigil-pulse":    "sigil-pulse 3s ease-in-out infinite",
        "sigil-thinking": "sigil-thinking 1.2s ease-in-out infinite",
        "sigil-strike":   "sigil-strike 350ms ease-out 1",
        "slide-up-in":    "slide-up-in 280ms ease-out 1",
        "flash-once":     "flash-once 250ms ease-out 1",
        "live-dot":       "live-dot 1.5s ease-in-out infinite",
        "lot-flip":       "lot-flip 400ms ease-out 1 both",
        "fade-in":        "fade-in 500ms ease-out 1 both",
      },
    },
  },
  plugins: [],
};
