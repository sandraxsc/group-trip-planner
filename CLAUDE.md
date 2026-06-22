# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm i                  # install dependencies
npm run dev            # Vite frontend dev server (http://localhost:5173)
npm run dev:server     # Express API proxy (http://localhost:3001) — required for AI features
npm run build          # production build → dist/
npm run test           # run all tests once (vitest)
npm run test:watch     # vitest in watch mode
```

Run a single test file:
```bash
npx vitest run src/utils/buildDayTimeline.test.ts
```

Validate API keys (optional):
```bash
npm run test:places-key
npm run test:openai-key
```

## Environment Setup

Copy `.env.example` to `.env`. The only required variable for basic dev is:
- `VITE_GOOGLE_PLACES_API_KEY` — enables destination search autocomplete

For AI features (`npm run dev:server`):
- `OPENAI_API_KEY` — server-side only (no `VITE_` prefix)
- `FSQ_API_KEY` — Foursquare Places API for activity search

For cross-device trip sharing:
- `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`

In development, Vite proxies `/api/*` → `http://localhost:3001`. For production split deploys (Vercel + Render), set `ALLOWED_ORIGINS` on the proxy server.

## Architecture

This is a mobile-first SPA (max-width 402px) built with React + Vite + TypeScript, backed by an Express API proxy server. Data is stored primarily in **localStorage** with optional Supabase cloud mirroring.

### Frontend (`src/`)

**Routing** (`src/app/routes.ts`): All routes are children of `Root`, which enforces onboarding completion before accessing any route (redirects to `/onboarding` with `?next=` if no profile exists).

**Screen flow**:
1. Onboarding → create user profile
2. Create/join trip → per-member preference collection (budget → energy → time → activities → places → deal-breakers → MBTI)
3. Vote screen → members upvote/downvote AI-suggested activity candidates
4. Trip plan → generated itinerary with AI day-reasoning

**Services** (`src/services/`): All business logic is in pure service files (no framework coupling):
- `userProfileService.ts` — localStorage-backed single-device profile; Supabase is a fire-and-forget mirror
- `tripService.ts`, `preferenceService.ts`, `voteService.ts` — same pattern: localStorage primary, Supabase optional
- `planningService.ts` — derives `GroupPlanningProfile` from all members' preferences (median budget/energy, intersection of active hours, union of activity types and excluded tags)
- `activityEngine.ts` — ranks vote candidates against the group profile
- `itineraryService.ts` — the main itinerary generation pipeline: calls planning → split-group detection → daily capacity → holistic day assignment → meal gap fill → day reasoning (all via AI proxy)
- `*CloudStore.ts` files — Supabase sync wrappers, always optional

**`src/config/apiProxy.ts`**: Resolves the base URL for `/api/*` calls (dev: `http://127.0.0.1:3001`, prod: `VITE_AI_PROXY_BASE_URL` or same origin).

**UI components**:
- `src/app/components/Duo*.tsx` — custom design-system components (DuoButton, DuoCard, DuoBadge, etc.)
- `src/app/components/ui/` — shadcn/ui primitives (Radix-based, do not modify unless updating the design system)
- MUI (`@mui/material`) is also present for some icons and date pickers

**Styling**: Tailwind CSS v4 (via `@tailwindcss/vite`). Design tokens are in `src/styles/tokens.ts`.

### Backend (`server/`)

`server/fsq-proxy.js` — single Express file that proxies:
- OpenAI Responses API (`/api/openai/*`) — all AI calls use structured JSON schema output (`text.format.type = "json_schema"`)
- Foursquare Places API (`/api/fsq/*`)
- Google Places searchText (server-side, for resolving AI-generated "pending" place IDs)

Each AI endpoint uses a strict JSON schema defined inline in the proxy file. The default OpenAI model is `gpt-4.1-mini` for most endpoints, `gpt-4o` for heavier planning tasks (split-group, holistic day assignment, daily capacity).

### Data flow for itinerary generation

```
Member preferences → GroupPlanningProfile → SplitGroupPlan (AI)
                                          → DailyCapacity (AI)
                                          → VoteCandidates → HolisticDayAssignment (AI)
                                          → MealGapFill (AI)
                                          → ItineraryDayReasoning (AI)
                                          → Itinerary (stored locally + Supabase)
```

### Types (`src/types/`)

Key types to understand before editing itinerary logic:
- `itinerary.ts` — `Itinerary`, `ItineraryDay`, `ItineraryBlock`, `ScheduledActivity`
- `preference.ts` — `MemberPreference`, `GroupPlanningProfile`
- `activity.ts` — `RankedCandidate`
- `splitGroupPlan.ts` — `SplitGroupPlanEvaluation`
