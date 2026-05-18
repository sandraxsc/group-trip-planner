/**
 * fetch() with AbortController timeout. Caller handles AbortError (e.g. 504 upstream timeout).
 */
export async function fetchWithTimeout(url, init = {}, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

export function isUpstreamTimeout(e) {
  return e?.name === "AbortError";
}
