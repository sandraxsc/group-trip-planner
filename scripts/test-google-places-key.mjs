/**
 * Smoke-test Google Places API (New) searchText using the key from .env.
 * Usage: node scripts/test-google-places-key.mjs
 * Reads VITE_GOOGLE_PLACES_API_KEY or GOOGLE_PLACES_API_KEY from project root .env
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
  (process.env.VITE_GOOGLE_PLACES_API_KEY || "").trim() ||
  (env.VITE_GOOGLE_PLACES_API_KEY || "").trim() ||
  (process.env.GOOGLE_PLACES_API_KEY || "").trim() ||
  (env.GOOGLE_PLACES_API_KEY || "").trim();

if (!apiKey) {
  console.error("No key found. Set VITE_GOOGLE_PLACES_API_KEY (or GOOGLE_PLACES_API_KEY) in .env");
  process.exit(1);
}

const url = "https://places.googleapis.com/v1/places:searchText";
const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": apiKey,
    "X-Goog-FieldMask": "places.displayName",
  },
  body: JSON.stringify({
    textQuery: "coffee shop Shibuya Tokyo",
    maxResultCount: 1,
  }),
});

const text = await res.text();
let data;
try {
  data = JSON.parse(text);
} catch {
  data = { raw: text.slice(0, 500) };
}

if (!res.ok) {
  console.error("Places API error:", res.status, res.statusText);
  console.error(typeof data === "object" ? JSON.stringify(data, null, 2) : data);
  process.exit(1);
}

const name = data.places?.[0]?.displayName?.text;
if (name) {
  console.log("OK — key works. Sample result:", name);
} else {
  console.log("OK — HTTP 200 but no places in response (check billing / Places API enabled):");
  console.log(JSON.stringify(data, null, 2));
}
