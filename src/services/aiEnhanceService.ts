import type { AiEnhanceRequest, AiEnhanceResponse } from "../types/aiEnhance";
import { getApiProxyBase } from "../config/apiProxy";

function validateResponse(data: unknown): AiEnhanceResponse {
  const fallback: AiEnhanceResponse = {
    summary: "No suggestions were generated.",
    proposals: [],
  };
  if (!data || typeof data !== "object") return fallback;
  const maybe = data as Partial<AiEnhanceResponse>;
  if (!Array.isArray(maybe.proposals) || typeof maybe.summary !== "string") return fallback;
  return {
    summary: maybe.summary,
    proposals: maybe.proposals.filter((p) => p && typeof p.id === "string" && typeof p.title === "string" && p.patch) as AiEnhanceResponse["proposals"],
  };
}

export async function requestAiEnhance(payload: AiEnhanceRequest): Promise<AiEnhanceResponse> {
  const base = getApiProxyBase();
  const url = `${base}/api/openai/enhance`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI enhance failed (${res.status}): ${text || res.statusText}`);
  }
  const data = (await res.json()) as unknown;
  return validateResponse(data);
}

