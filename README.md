
  # Lofi to Hifi Mobile Prototype

  This is a code bundle for Lofi to Hifi Mobile Prototype. The original project is available at https://www.figma.com/design/vEGKWS7NMYxNBNGGYHGc6L/Lofi-to-Hifi-Mobile-Prototype.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

## Google Places Autocomplete (demo)

This demo's destination search supports Google Places autocomplete.

- **Setup**
  - Create a Google Cloud project and enable **Places API** (Places API (New)).
  - Create an API key (restrict it to your domains / `http://localhost:5173/*` for dev).
  - Copy `.env.example` to `.env` and set `VITE_GOOGLE_PLACES_API_KEY`.
  - Restart `npm run dev`.

- **Trip detail: transit times between stops**
  - By default the app **does not** call Google **Routes API** (so a Places-only key never hits `routes.googleapis.com`).
  - Between stops it uses **distance-based estimates** (walk vs drive heuristic).
  - For **traffic-aware driving** times, enable **Routes API** on your Google Cloud project, then either:
    - set `VITE_GOOGLE_ROUTES_ENABLED=true` and keep using `VITE_GOOGLE_PLACES_API_KEY`, or
    - set `VITE_GOOGLE_ROUTES_API_KEY` to a key that has Routes API enabled.
  - Restart `npm run dev` after changing `.env`.

- **AI Enhance (selective apply)**
  - Start the proxy server in one terminal: `npm run dev:server`
  - Set `OPENAI_API_KEY` in `.env` (server-side only; no `VITE_` prefix).
  - Optional: set `OPENAI_MODEL` (default is `gpt-4.1-mini`).
  - In Trip Detail, click **AI Improve** and submit your request.
  - The app shows suggested changes with checkboxes; **Apply selected changes** updates in-memory draft only.
  - Use **Save itinerary** to persist.

- **Note on API keys**
  - `VITE_*` env vars are bundled into the frontend, so the key is visible in the browser.
  - For anything beyond a demo, use a small backend proxy (recommended) so your API key is not shipped to clients.

## Vercel frontend + Render API (split deploy)

1. Deploy this repo’s **static build** to Vercel (`npm run build`, output `dist/`).
2. Deploy **`server/fsq-proxy.js`** to Render (or similar) as a **Web Service**:
   - **Start command:** `node server/fsq-proxy.js`
   - **Env:** `OPENAI_API_KEY`, `FSQ_API_KEY` (if used), `ALLOWED_ORIGINS=https://your-app.vercel.app`, `NODE_ENV=production`, `PORT` (Render sets this automatically).
3. Edit **`vercel.json`**: replace `https://your-backend.onrender.com` with your real Render URL (no trailing slash).
4. On Vercel, **do not** set `OPENAI_API_KEY` or `FSQ_API_KEY`. The browser only calls **`/api/*`**; Vercel rewrites those to Render.
5. **Health check:** after deploy, open `https://your-backend.onrender.com/api/health` — should return plain `ok`.

## Publishing safely (secrets + CORS)

- **OpenAI / Foursquare**
  - Keep `OPENAI_API_KEY` and `FSQ_API_KEY` **only** on the server running `server/fsq-proxy.js`.
  - Do **not** add `VITE_OPENAI_*` or similar; those would leak to every visitor.

- **Frontend → API URL**
  - In development, Vite proxies `/api` to `http://localhost:3001` (see `vite.config.ts`).
  - For production, prefer **one public origin** (e.g. `https://app.example.com`) and reverse-proxy `/api` to the Node proxy.
  - Only set `VITE_AI_PROXY_BASE_URL` if the SPA is hosted on a **different** domain than the API (value = API origin, no trailing slash).

- **CORS**
  - Set `ALLOWED_ORIGINS` on the proxy to a comma-separated list of allowed web origins (e.g. `https://app.example.com`).
  - In **production**, if `ALLOWED_ORIGINS` is empty, browsers that send `Origin` get **403** (blocks random sites from using your API). Same-origin reverse-proxy setups typically omit `Origin` and still work.
  - In **development**, empty `ALLOWED_ORIGINS` keeps permissive `*` CORS for local use.

- **Google (Places / Routes)**
  - Still used from the browser today; restrict keys in Google Cloud (HTTP referrer / domain) and enable only the APIs you need. True hiding of Google keys requires a dedicated backend proxy (not included here).
  