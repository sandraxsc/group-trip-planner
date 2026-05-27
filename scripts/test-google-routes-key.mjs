/**
 * Smoke-test Google Routes API (computeRoutes) using keys from .env.
 * Usage: node scripts/test-google-routes-key.mjs
 * Does not print API keys.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\n/)) {
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

const env = loadEnvFile(resolve(process.cwd(), ".env"));
const routesKey = (env.VITE_GOOGLE_ROUTES_API_KEY || "").trim();
const placesKey = (env.VITE_GOOGLE_PLACES_API_KEY || "").trim();
const routesEnabled =
  env.VITE_GOOGLE_ROUTES_ENABLED === "true" || env.VITE_GOOGLE_ROUTES_ENABLED === "1";
const apiKey = routesKey || (routesEnabled ? placesKey : "");

console.log("Config:");
console.log("  VITE_GOOGLE_ROUTES_API_KEY:", routesKey ? `(set, ${routesKey.length} chars)` : "(not set)");
console.log("  VITE_GOOGLE_ROUTES_ENABLED:", routesEnabled);
console.log("  VITE_GOOGLE_PLACES_API_KEY:", placesKey ? `(set, ${placesKey.length} chars)` : "(not set)");
console.log("  Will call Routes API:", apiKey ? "yes" : "no (heuristic fallback only)");

if (!apiKey) {
  console.log(
    "\nResult: Routes API not configured. Set VITE_GOOGLE_ROUTES_API_KEY or VITE_GOOGLE_ROUTES_ENABLED=true."
  );
  process.exit(2);
}

const origin = { latitude: 35.6595, longitude: 139.7005 };
const dest = { latitude: 35.7074, longitude: 139.6659 };

const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": apiKey,
    "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
  },
  body: JSON.stringify({
    origin: { location: { latLng: origin } },
    destination: { location: { latLng: dest } },
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
  }),
});

const text = await res.text();
let data;
try {
  data = JSON.parse(text);
} catch {
  data = { raw: text.slice(0, 600) };
}

console.log("\nHTTP status:", res.status, res.statusText);
if (res.ok && data.routes?.[0]) {
  const r = data.routes[0];
  const sec = r.duration?.match(/^(\d+)s$/)?.[1];
  console.log("Result: OK");
  console.log("  duration:", r.duration, sec ? `(${Math.round(Number(sec) / 60)} min)` : "");
  console.log("  distanceMeters:", r.distanceMeters);
  process.exit(0);
}

console.log("Result: FAILED");
if (data.error) console.log("  error:", JSON.stringify(data.error, null, 2));
else console.log("  body:", JSON.stringify(data, null, 2).slice(0, 800));
if (res.status === 403) {
  console.log('  Hint: Enable "Routes API" for this key in Google Cloud Console.');
}
if (res.status === 400) {
  console.log("  Hint: Often invalid key, billing disabled, or bad coordinates.");
}
process.exit(1);
