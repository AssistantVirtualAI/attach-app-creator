// Hardcoded owner of the AVA Main Dashboard organization.
// Only this user may access AVA org content and the AI Usage page.
export const AVA_OWNER_USER_ID = "e5d025c9-eef2-4422-b97d-3190388b7376";
export const AVA_ORG_ID = "17d6507f-a9ca-409d-8e49-371d50332615";
export const LEMTEL_ORG_ID = "71755d33-ed64-4ad5-a828-61c9d2029eb7";

// Rough Lovable AI Gateway pricing (USD per 1M tokens) — adjust as needed.
// We don't store token counts yet, so we estimate avg tokens / request per model.
export const AI_MODEL_PRICING: Record<
  string,
  { in: number; out: number; avgIn: number; avgOut: number }
> = {
  "google/gemini-2.5-pro":        { in: 1.25,  out: 5.00,  avgIn: 1500, avgOut: 600 },
  "google/gemini-2.5-flash":      { in: 0.075, out: 0.30,  avgIn: 1500, avgOut: 600 },
  "google/gemini-2.5-flash-lite": { in: 0.04,  out: 0.15,  avgIn: 1500, avgOut: 400 },
  "google/gemini-3.5-flash":      { in: 0.10,  out: 0.40,  avgIn: 1500, avgOut: 600 },
  "google/gemini-3.1-pro-preview":{ in: 2.00,  out: 8.00,  avgIn: 1500, avgOut: 600 },
  "openai/gpt-5":                 { in: 2.50,  out: 10.00, avgIn: 1500, avgOut: 600 },
  "openai/gpt-5-mini":            { in: 0.25,  out: 1.00,  avgIn: 1500, avgOut: 600 },
  "openai/gpt-5-nano":            { in: 0.05,  out: 0.20,  avgIn: 1500, avgOut: 400 },
};

export function estimateCostUSD(model: string | null, requests: number): number {
  if (!model || requests <= 0) return 0;
  const p = AI_MODEL_PRICING[model] ?? { in: 0.5, out: 2.0, avgIn: 1500, avgOut: 600 };
  const inputCost = (p.avgIn * requests * p.in) / 1_000_000;
  const outputCost = (p.avgOut * requests * p.out) / 1_000_000;
  return inputCost + outputCost;
}
