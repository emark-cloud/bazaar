// Tiny ANSI helper — no dependency. Honors --no-color / NO_COLOR / non-TTY.
let enabled = process.stdout.isTTY && !process.env.NO_COLOR;
export function setColor(on) { enabled = on; }
const wrap = (code) => (s) => (enabled ? `\x1b[${code}m${s}\x1b[0m` : String(s));

export const c = {
  green: wrap("32"),
  red: wrap("31"),
  yellow: wrap("33"),
  cyan: wrap("36"),
  gray: wrap("90"),
  bold: wrap("1"),
  dim: wrap("2"),
};

export const SYM = {
  pass: () => c.green("PASS"),
  fail: () => c.red("FAIL"),
  skip: () => c.yellow("SKIP"),
};

/** Render the final column of checks. */
export function renderChecks(checks) {
  const out = [];
  for (const ch of checks) {
    const tag = ch.status === "pass" ? SYM.pass() : ch.status === "fail" ? SYM.fail() : SYM.skip();
    const mark = ch.status === "pass" ? c.green("✓") : ch.status === "fail" ? c.red("✗") : c.yellow("–");
    out.push(`  ${mark} ${tag}  ${c.bold(ch.name.padEnd(20))} ${c.gray(ch.detail || "")}`);
    for (const sub of ch.lines || []) out.push(`            ${c.gray(sub)}`);
  }
  return out.join("\n");
}
