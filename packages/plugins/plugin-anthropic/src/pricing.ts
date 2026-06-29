// ─────────────────────────────────────────────────────────────────────────────
// Anthropic model pricing registry
//
// Source: https://www.anthropic.com/pricing  (June 2025)
// Prices are per 1M tokens.
// ─────────────────────────────────────────────────────────────────────────────

export interface PricingEntry {
  inputCostPer1MTokens: number;
  outputCostPer1MTokens: number;
  contextWindow: number;
  displayName: string;
}

// Prefix-keyed: the real model id from the API may include a date suffix
// (e.g. "claude-sonnet-4-6-20250219"). We match by prefix.
const TABLE: Record<string, PricingEntry> = {
  'claude-opus-4-8':   { inputCostPer1MTokens: 15.00, outputCostPer1MTokens: 75.00,  contextWindow: 200_000, displayName: 'Claude Opus 4.8'  },
  'claude-sonnet-4-6': { inputCostPer1MTokens:  3.00, outputCostPer1MTokens: 15.00,  contextWindow: 200_000, displayName: 'Claude Sonnet 4.6' },
  'claude-haiku-4-5':  { inputCostPer1MTokens:  0.25, outputCostPer1MTokens:  1.25,  contextWindow: 200_000, displayName: 'Claude Haiku 4.5'  },
  // Legacy Claude 3.x models
  'claude-3-5-sonnet': { inputCostPer1MTokens:  3.00, outputCostPer1MTokens: 15.00,  contextWindow: 200_000, displayName: 'Claude 3.5 Sonnet' },
  'claude-3-5-haiku':  { inputCostPer1MTokens:  0.80, outputCostPer1MTokens:  4.00,  contextWindow: 200_000, displayName: 'Claude 3.5 Haiku'  },
  'claude-3-opus':     { inputCostPer1MTokens: 15.00, outputCostPer1MTokens: 75.00,  contextWindow: 200_000, displayName: 'Claude 3 Opus'     },
  'claude-3-sonnet':   { inputCostPer1MTokens:  3.00, outputCostPer1MTokens: 15.00,  contextWindow: 200_000, displayName: 'Claude 3 Sonnet'   },
  'claude-3-haiku':    { inputCostPer1MTokens:  0.25, outputCostPer1MTokens:  1.25,  contextWindow: 200_000, displayName: 'Claude 3 Haiku'    },
};

const FALLBACK: PricingEntry = {
  inputCostPer1MTokens: 3.00,
  outputCostPer1MTokens: 15.00,
  contextWindow: 200_000,
  displayName: 'Claude',
};

export function getPricing(modelId: string): PricingEntry {
  if (TABLE[modelId]) return TABLE[modelId];

  for (const [prefix, entry] of Object.entries(TABLE)) {
    if (modelId.startsWith(prefix)) return entry;
  }

  return FALLBACK;
}

export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  modelId: string,
): number {
  const p = getPricing(modelId);
  return (
    (inputTokens  / 1_000_000) * p.inputCostPer1MTokens +
    (outputTokens / 1_000_000) * p.outputCostPer1MTokens
  );
}
