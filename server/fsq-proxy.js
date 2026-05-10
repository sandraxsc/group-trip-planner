/**
 * API proxy (Express) — OpenAI + Foursquare server-side only.
 *
 * Env (never VITE_*): OPENAI_API_KEY, FSQ_API_KEY, GOOGLE_PLACES_API_KEY, ALLOWED_ORIGINS, OPENAI_MODEL, PORT
 * (Optional) VITE_GOOGLE_PLACES_API_KEY in .env is mirrored for local dev so the proxy can resolve real places without duplicating the key.
 * Dev: npm run dev:server  +  npm run dev (Vite proxies /api → this server)
 *
 * Routes:
 *   GET  /api/health
 *   POST /api/openai/enhance
 *   GET  /api/fsq/health
 *   GET  /api/fsq/search
 *   GET  /api/fsq/places/:fsq_id
 */
import express from "express";
import cors from "cors";
import https from "https";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { searchTextFirstPlace } from "./placesGoogle.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV !== "production";

try {
  const envPath = path.resolve(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^\s*FSQ_API_KEY\s*=\s*(.+?)\s*$/);
      if (m && !process.env.FSQ_API_KEY) process.env.FSQ_API_KEY = m[1].replace(/^["']|["']$/g, "").trim();
      const openAiMatch = line.match(/^\s*OPENAI_API_KEY\s*=\s*(.+?)\s*$/);
      if (openAiMatch && !process.env.OPENAI_API_KEY) {
        process.env.OPENAI_API_KEY = openAiMatch[1].replace(/^["']|["']$/g, "").trim();
      }
      const corsMatch = line.match(/^\s*ALLOWED_ORIGINS\s*=\s*(.+?)\s*$/);
      if (corsMatch && !process.env.ALLOWED_ORIGINS) {
        process.env.ALLOWED_ORIGINS = corsMatch[1].replace(/^["']|["']$/g, "").trim();
      }
      const gpMatch = line.match(/^\s*GOOGLE_PLACES_API_KEY\s*=\s*(.+?)\s*$/);
      if (gpMatch && !process.env.GOOGLE_PLACES_API_KEY) {
        process.env.GOOGLE_PLACES_API_KEY = gpMatch[1].replace(/^["']|["']$/g, "").trim();
      }
      const gpVite = line.match(/^\s*VITE_GOOGLE_PLACES_API_KEY\s*=\s*(.+?)\s*$/);
      if (gpVite && !process.env.GOOGLE_PLACES_API_KEY) {
        process.env.GOOGLE_PLACES_API_KEY = gpVite[1].replace(/^["']|["']$/g, "").trim();
      }
    }
  }
} catch (_) {}

const FSQ_BASE = "https://places-api.foursquare.com";
const OPENAI_BASE = "https://api.openai.com/v1/responses";
const PORT = Number(process.env.PORT) || 3001;
const BODY_TRUNCATE = 500;

function getFsqKey() {
  return process.env.FSQ_API_KEY?.trim() || null;
}

function getOpenAiKey() {
  return process.env.OPENAI_API_KEY?.trim() || null;
}

function getPlacesKey() {
  return process.env.GOOGLE_PLACES_API_KEY?.trim() || process.env.VITE_GOOGLE_PLACES_API_KEY?.trim() || null;
}

/** Normalize for comparison (Render env often has trailing slashes or spaces). */
function normalizeOrigin(origin) {
  if (typeof origin !== "string") return "";
  let o = origin.trim();
  if ((o.startsWith("http://") || o.startsWith("https://")) && o.endsWith("/")) {
    o = o.slice(0, -1);
  }
  return o;
}

/** Exact origins plus optional host suffixes (e.g. ".vercel.app" for all Vercel deployments). */
function parseAllowedOriginsConfig() {
  const raw = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const exact = new Set();
  const hostSuffixes = [];
  for (const entry of raw) {
    const lower = entry.toLowerCase();
    if (lower === "*.vercel.app" || lower === "https://*.vercel.app") {
      hostSuffixes.push(".vercel.app");
      continue;
    }
    const n = normalizeOrigin(entry);
    if (n) exact.add(n);
  }
  return { exact, hostSuffixes };
}

function isOriginAllowed(reqOrigin, cfg) {
  const norm = normalizeOrigin(reqOrigin || "");
  if (!norm) return true;
  if (cfg.exact.has(norm)) return true;
  try {
    const host = new URL(reqOrigin).hostname;
    for (const suf of cfg.hostSuffixes) {
      if (host === suf.slice(1) || host.endsWith(suf)) return true;
    }
  } catch (_) {
    /* ignore */
  }
  return false;
}

function truncate(str, max = BODY_TRUNCATE) {
  if (typeof str !== "string") return String(str).slice(0, max);
  return str.length <= max ? str : str.slice(0, max) + "...";
}

const enhanceSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    proposals: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          reason: { type: "string" },
          patch: {
            type: "object",
            additionalProperties: false,
            properties: {
              kind: { type: "string", enum: ["update_row", "insert_row", "remove_row"] },
              day: { type: "number" },
              rowId: { type: ["string", "null"] },
              changes: {
                type: "object",
                additionalProperties: false,
                properties: {
                  kind: { type: ["string", "null"] },
                  placeId: { type: ["string", "null"] },
                  mealSlot: { type: ["string", "null"] },
                  hotelLabel: { type: ["string", "null"] },
                  activityLabel: { type: ["string", "null"] },
                  isPlaceholder: { type: ["boolean", "null"] },
                },
                required: ["kind", "placeId", "mealSlot", "hotelLabel", "activityLabel", "isPlaceholder"],
              },
              index: { type: ["number", "null"] },
              row: {
                type: "object",
                additionalProperties: false,
                properties: {
                  id: { type: ["string", "null"] },
                  kind: { type: "string", enum: ["hotel", "activity"] },
                  placeId: { type: ["string", "null"] },
                  mealSlot: { type: ["string", "null"] },
                  hotelLabel: { type: ["string", "null"] },
                  activityLabel: { type: ["string", "null"] },
                  isPlaceholder: { type: ["boolean", "null"] },
                },
                required: ["id", "kind", "placeId", "mealSlot", "hotelLabel", "activityLabel", "isPlaceholder"],
              },
            },
            required: ["kind", "day", "rowId", "changes", "index", "row"],
          },
        },
        required: ["id", "title", "reason", "patch"],
      },
    },
  },
  required: ["summary", "proposals"],
};

/**
 * Build a Places searchText query and optional includedType for insert_row activity proposals.
 */
function buildPlaceQueryForInsert({ destination, userText, proposalTitle, proposalReason, activityLabel }) {
  const combined = `${userText} ${proposalTitle} ${proposalReason} ${activityLabel ?? ""}`;
  const t = combined.toLowerCase();
  const dest = destination.trim() || "city center";

  if (/\b(lunch)\b/.test(t)) {
    return { textQuery: `${dest} lunch restaurant`, includedType: "restaurant", mealSlot: "lunch" };
  }
  if (/\b(dinner|supper)\b/.test(t)) {
    return { textQuery: `${dest} dinner restaurant`, includedType: "restaurant", mealSlot: "dinner" };
  }
  if (/\b(breakfast|brunch)\b/.test(t)) {
    return { textQuery: `${dest} breakfast cafe brunch`, includedType: "cafe", mealSlot: undefined };
  }
  if (/\b(coffee|cafe|coffee shop)\b/.test(t)) {
    return { textQuery: `${dest} specialty coffee cafe`, includedType: "cafe", mealSlot: undefined };
  }
  if (/\b(restaurant|eat|dining|food|meal|bite)\b/.test(t)) {
    return { textQuery: `${dest} highly rated restaurants`, includedType: "restaurant", mealSlot: undefined };
  }

  const hint = String(activityLabel ?? "")
    .trim()
    .replace(/^recommended\s+/i, "")
    .replace(/\bpending-[a-z0-9-]+\b/gi, "")
    .trim();
  if (hint.length > 2) {
    return { textQuery: `${dest} ${hint.slice(0, 100)}`, includedType: null, mealSlot: undefined };
  }
  return { textQuery: `${dest} popular things to do`, includedType: "tourist_attraction", mealSlot: undefined };
}

/**
 * Replace pending activity rows with real Google place ids + names from searchText (server key).
 */
async function enrichProposalsWithPlaces(parsed, body) {
  const apiKey = getPlacesKey();
  if (!apiKey || !Array.isArray(parsed?.proposals)) return;

  const destination = String(body?.trip?.destination ?? "").trim() || String(body?.trip?.name ?? "").trim();
  const userText = [body?.enhanceRequest, body?.dissatisfaction].filter(Boolean).join(" ");

  for (const p of parsed.proposals) {
    const patch = p.patch;
    if (!patch || patch.kind !== "insert_row" || !patch.row || patch.row.kind !== "activity") continue;
    const row = patch.row;
    const pid = row.placeId;
    if (pid && typeof pid === "string" && !pid.startsWith("pending-")) continue;

    const { textQuery, includedType, mealSlot } = buildPlaceQueryForInsert({
      destination,
      userText,
      proposalTitle: p.title,
      proposalReason: p.reason,
      activityLabel: row.activityLabel,
    });
    if (mealSlot && !row.mealSlot) row.mealSlot = mealSlot;

    let hit = await searchTextFirstPlace({ apiKey, textQuery, includedType, maxResultCount: 5 });
    if (!hit && includedType) {
      hit = await searchTextFirstPlace({ apiKey, textQuery, includedType: null, maxResultCount: 5 });
    }
    if (!hit) continue;

    row.placeId = hit.placeId;
    row.activityLabel = hit.displayName;
    row.isPlaceholder = false;
  }
}

async function runOpenAiEnhance(body) {
  const enhanceRequest = String(body?.enhanceRequest ?? "").trim();
  const dissatisfaction = String(body?.dissatisfaction ?? "").trim();
  if (!enhanceRequest && !dissatisfaction) {
    return { status: 400, json: { error: "Missing enhancement request input" } };
  }

  const openAiKey = getOpenAiKey();
  if (!openAiKey) {
    return { status: 503, json: { error: "OPENAI_API_KEY not configured" } };
  }

  const instructions =
    "You are a trip itinerary enhancement assistant. Return only practical, minimal edits. " +
    "Use day numbers and existing row ids from currentEditRowsByDay whenever possible. " +
    "Do not create large rewrites; propose small selectable changes. " +
    "If user asks for transport/public transit, focus on reordering nearby items and reducing long hops. " +
    "If user says a day is too packed, remove or replace one activity. " +
    "For new restaurants, cafés, or POIs, use insert_row with kind activity, placeId pending-<random>, isPlaceholder true, " +
    "and a short activityLabel hint (e.g. lunch near meeting point). Do not invent real business names or addresses; " +
    "the server resolves pending rows to real Google Places via search.";

  const openAiPayload = {
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    input: [
      { role: "system", content: [{ type: "input_text", text: instructions }] },
      { role: "user", content: [{ type: "input_text", text: JSON.stringify(body) }] },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "itinerary_enhance_response",
        schema: enhanceSchema,
        strict: true,
      },
    },
  };

  const upstream = await fetch(OPENAI_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify(openAiPayload),
  });

  if (!upstream.ok) {
    const errorText = await upstream.text().catch(() => "");
    return {
      status: upstream.status || 502,
      json: { error: "OpenAI request failed", body: truncate(errorText) },
    };
  }

  const json = await upstream.json();
  let textOutput = typeof json?.output_text === "string" ? json.output_text : "";
  if (!textOutput) {
    const outputs = Array.isArray(json?.output) ? json.output : [];
    const chunks = [];
    for (const item of outputs) {
      const content = Array.isArray(item?.content) ? item.content : [];
      for (const c of content) {
        if (typeof c?.text === "string" && c.text.trim()) chunks.push(c.text);
      }
    }
    textOutput = chunks.join("\n").trim();
  }
  if (!textOutput) {
    return { status: 502, json: { error: "OpenAI response missing text output" } };
  }

  try {
    const parsed = JSON.parse(textOutput);
    await enrichProposalsWithPlaces(parsed, body);
    return { status: 200, json: parsed };
  } catch {
    return { status: 502, json: { error: "Failed to parse OpenAI JSON", body: truncate(textOutput) } };
  }
}

function proxyFsqGet(fsqPath, res, logLabel) {
  const key = getFsqKey();
  if (!key) {
    res.status(503).json({ error: "FSQ_API_KEY not configured" });
    return;
  }
  const url = `${FSQ_BASE}${fsqPath}`;
  if (isDev) console.log(`[api-proxy] ${logLabel} → ${url}`);

  const opts = {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${key}`,
      "X-Places-Api-Version": "2025-06-17",
    },
  };

  https
    .get(url, opts, (proxyRes) => {
      const chunks = [];
      proxyRes.on("data", (chunk) => chunks.push(chunk));
      proxyRes.on("end", () => {
        const body = Buffer.concat(chunks).toString();
        const status = proxyRes.statusCode || 500;
        if (isDev) console.log(`[api-proxy] ${logLabel} ← ${status}`);
        res.status(status).type("application/json").send(body);
      });
    })
    .on("error", (err) => {
      res.status(502).json({ error: "Proxy upstream error", message: err.message });
    });
}

const app = express();
app.use(express.json({ limit: "1mb" }));

const allowedCfg = parseAllowedOriginsConfig();
app.use(
  cors({
    origin(origin, callback) {
      const reqOrigin = normalizeOrigin(origin || "");
      const hasRules = allowedCfg.exact.size > 0 || allowedCfg.hostSuffixes.length > 0;
      if (!hasRules) {
        if (isDev) return callback(null, origin || true);
        if (!reqOrigin) return callback(null, true);
        return callback(
          new Error(
            `CORS: set ALLOWED_ORIGINS on Render (received Origin: ${reqOrigin}). Example: https://group-trip-planner-inky.vercel.app,*.vercel.app`
          )
        );
      }
      if (!reqOrigin) return callback(null, true);
      if (isOriginAllowed(origin || "", allowedCfg)) return callback(null, true);
      const hint =
        allowedCfg.hostSuffixes.includes(".vercel.app") ? "" : " Add *.vercel.app to allow Vercel preview URLs.";
      callback(
        new Error(
          `CORS: origin not allowed (received: ${reqOrigin}).${hint} Update ALLOWED_ORIGINS on Render (production URL + *.vercel.app if you use previews).`
        )
      );
    },
    credentials: true,
  })
);

app.get("/api/health", (_req, res) => {
  res.type("text/plain").send("ok");
});

app.post("/api/openai/enhance", async (req, res) => {
  try {
    const result = await runOpenAiEnhance(req.body);
    res.status(result.status).json(result.json);
  } catch (e) {
    res.status(500).json({ error: "Enhance handler error", message: e?.message ?? String(e) });
  }
});

app.get("/api/fsq/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/fsq/search", (req, res) => {
  const query = req.query.query;
  const near = req.query.near;
  if (query == null || String(query).trim() === "") {
    res.status(400).json({ error: "Missing or empty query parameter" });
    return;
  }
  if (near == null || String(near).trim() === "") {
    res.status(400).json({ error: "Missing or empty near parameter" });
    return;
  }
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) {
    if (Array.isArray(v)) v.forEach((x) => qs.append(k, String(x)));
    else if (v != null) qs.set(k, String(v));
  }
  proxyFsqGet(`/places/search?${qs.toString()}`, res, "search");
});

app.get("/api/fsq/places/:fsqId", (req, res) => {
  const fsqId = req.params.fsqId;
  if (!fsqId) {
    res.status(400).json({ error: "Missing fsq_id in path" });
    return;
  }
  proxyFsqGet(`/places/${encodeURIComponent(fsqId)}`, res, "details");
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.path });
});

app.use((err, _req, res, _next) => {
  if (err?.message?.startsWith("CORS")) {
    res.status(403).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: "Server error", message: err?.message ?? String(err) });
});

app.listen(PORT, () => {
  console.log(
    `[api-proxy] Express http://localhost:${PORT} (FSQ: ${getFsqKey() ? "set" : "NOT SET"}, OPENAI: ${getOpenAiKey() ? "set" : "NOT SET"}, PLACES: ${getPlacesKey() ? "set" : "NOT SET"}, CORS: ${[...allowedCfg.exact].join(", ") || "(none)"}${allowedCfg.hostSuffixes.length ? ` + suffix:${allowedCfg.hostSuffixes.join(",")}` : ""}${isDev ? " (dev)" : ""})`
  );
});
