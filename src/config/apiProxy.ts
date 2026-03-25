/**
 * Backend API base URL (Express on PORT, default 3001).
 * - Production: empty string → same-origin `/api/*` (Vercel rewrite or reverse proxy).
 * - Development: default `http://127.0.0.1:3001` so calls don't rely on Vite's dev proxy
 *   (avoids intermittent 404 on POST /api/...).
 * - Override: `VITE_AI_PROXY_BASE_URL` or `VITE_FSQ_PROXY_URL` (first non-empty wins).
 */
export function getApiProxyBase(): string {
  const ai = (import.meta.env.VITE_AI_PROXY_BASE_URL as string | undefined)?.trim();
  if (ai) return ai.replace(/\/$/, "");
  const fsq = (import.meta.env.VITE_FSQ_PROXY_URL as string | undefined)?.trim();
  if (fsq) return fsq.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://127.0.0.1:3001";
  return "";
}
