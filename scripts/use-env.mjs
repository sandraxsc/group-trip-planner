/**
 * Copy branch-specific env into .env for local dev.
 *
 *   npm run env:iteration   → uses .env.iteration (or .env.iteration.example)
 *   npm run env:main        → uses .env.main (or .env.main.example)
 *
 * Create .env.iteration / .env.main from the matching .example files and paste
 * your Supabase project URL + anon key for each project.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const target = process.argv[2];
if (!target || !["iteration", "main"].includes(target)) {
  console.error("Usage: npm run env:iteration | npm run env:main");
  process.exit(1);
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dest = path.join(root, ".env");
const candidates = [`.env.${target}`, `.env.${target}.example`];

let sourcePath = null;
for (const name of candidates) {
  const p = path.join(root, name);
  if (fs.existsSync(p)) {
    sourcePath = p;
    break;
  }
}

if (!sourcePath) {
  console.error(`Missing .env.${target} — copy .env.${target}.example and fill in keys.`);
  process.exit(1);
}

fs.copyFileSync(sourcePath, dest);
const usingExample = sourcePath.endsWith(".example");
console.log(`✓ ${path.basename(sourcePath)} → .env`);
if (usingExample) {
  console.warn(
    `⚠ Still using the example file. Copy to .env.${target}, add real Supabase keys, then run again.`
  );
}
console.log("Restart `npm run dev` (and `npm run dev:server` if running) to pick up changes.");
