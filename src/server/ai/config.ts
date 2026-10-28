import "server-only";

/**
 * AI wiring. Claude (Anthropic SDK, ANTHROPIC_API_KEY) does the reasoning:
 * extraction, vision, assistant, reviews. Embeddings and transcription go
 * through Vercel AI Gateway, which authenticates with the deployment's OIDC
 * identity on Vercel (or AI_GATEWAY_API_KEY elsewhere).
 * AI_MOCK=1 swaps every call for a deterministic local stand-in, so the whole
 * pipeline can be exercised in development without credentials or cost.
 */
export const AI_MODEL = process.env.AI_MODEL || "claude-opus-5-5";
export const EMBEDDING_MODEL = "voyage/voyage-4-lite";
export const TRANSCRIPTION_MODEL = process.env.AI_TRANSCRIPTION_MODEL || "elevenlabs/scribe-v2";

/** Monthly ceiling on Claude spend, in US dollars. */
export const MONTHLY_BUDGET_USD = Number(process.env.AI_MONTHLY_BUDGET_USD || 25);

export function aiMock() {
  return process.env.AI_MOCK === "1";
}

export function claudeAvailable() {
  return aiMock() || Boolean(process.env.ANTHROPIC_API_KEY);
}

export function gatewayAvailable() {
  return aiMock() || Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL);
}

export function aiStatus() {
  return {
    claude: claudeAvailable(),
    gateway: gatewayAvailable(),
    mock: aiMock(),
    model: AI_MODEL,
    budgetUsd: MONTHLY_BUDGET_USD,
  };
}

/** Per-million-token prices (input, output) in US dollars, for the cost ledger. */
const PRICES: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-fable-5-1": [10, 50],
};

/** Cost in micro-dollars (1e-6 USD). Unknown models count at Opus rates. */
export function costMicros(model: string, inputTokens: number, outputTokens: number) {
  const key = Object.keys(PRICES).find((id) => model.startsWith(id));
  const [input, output] = PRICES[key ?? "claude-opus-5-5"];
  return Math.round(inputTokens * input + outputTokens * output);
}
