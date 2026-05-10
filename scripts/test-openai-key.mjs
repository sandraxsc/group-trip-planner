/**
 * Smoke-test OpenAI API key (Bearer auth).
 * Usage: node scripts/test-openai-key.mjs
 * Reads OPENAI_API_KEY from project root .env (or process.env).
 * Does not print the key.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8");
  const out = {};
  for (const line of raw.split(/\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const root = resolve(process.cwd());
const env = loadEnvFile(resolve(root, ".env"));
const apiKey =
  (process.env.OPENAI_API_KEY || "").trim() || (env.OPENAI_API_KEY || "").trim();

if (!apiKey) {
  console.error("No key found. Set OPENAI_API_KEY in .env (server-side; never VITE_).");
  process.exit(1);
}

const res = await fetch("https://api.openai.com/v1/models", {
  method: "GET",
  headers: {
    Authorization: `Bearer ${apiKey}`,
  },
});

const text = await res.text();
let data;
try {
  data = JSON.parse(text);
} catch {
  data = { raw: text.slice(0, 500) };
}

if (!res.ok) {
  console.error("OpenAI API error:", res.status, res.statusText);
  console.error(typeof data === "object" ? JSON.stringify(data, null, 2) : data);
  process.exit(1);
}

const count = Array.isArray(data.data) ? data.data.length : 0;
const sample = data.data?.[0]?.id;
if (sample) {
  console.log("OK — key works. Listed", count, "models (e.g.", sample + ").");
} else {
  console.log("OK — HTTP 200 but unexpected response shape:");
  console.log(JSON.stringify(data, null, 2).slice(0, 800));
}
