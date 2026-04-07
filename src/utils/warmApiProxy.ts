import { getApiProxyBase } from "../config/apiProxy";

const SESSION_KEY = "groupTripApiProxyWarmup";

/**
 * Fire-and-forget GET /api/health so a cold Render (or local proxy) can spin up
 * while the user is on Home. At most once per tab session.
 */
export function warmApiProxyOncePerSession(): void {
  try {
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(SESSION_KEY)) {
      return;
    }
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(SESSION_KEY, "1");
    }
  } catch {
    // private mode / blocked storage — still try once
  }

  const base = getApiProxyBase();
  const url = `${base}/api/health`;

  void fetch(url, { method: "GET", cache: "no-store", mode: "cors" }).catch(() => {
    /* proxy down or asleep — ignore */
  });
}
