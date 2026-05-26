#!/usr/bin/env node
/**
 * create-somnia-agent — copy the starter-kit template into a new directory.
 *
 *   npx create-somnia-agent my-agent
 *   cd my-agent && pnpm install
 */
import { cp, readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = resolve(__dirname, "..", "template");

const target = process.argv[2];
if (!target) {
  console.error("usage: npx create-somnia-agent <directory>");
  process.exit(2);
}

const dest = resolve(process.cwd(), target);
if (existsSync(dest)) {
  console.error(`refusing to overwrite existing path: ${dest}`);
  process.exit(2);
}

await mkdir(dest, { recursive: true });
await cp(TEMPLATE, dest, { recursive: true });

const pkgPath = join(dest, "package.json");
const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
pkg.name = target.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

console.log(`✓ scaffolded ${target}/`);
console.log("");
console.log("Next steps:");
console.log(`  cd ${target}`);
console.log("  cp .env.example .env  # add PRIVATE_KEY");
console.log("  pnpm install");
console.log("  pnpm mint");
console.log("  pnpm fund 30");
console.log("  pnpm enter");
