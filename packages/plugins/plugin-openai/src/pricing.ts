// ─────────────────────────────────────────────────────────────────────────────
// OpenAI model pricing registry
//
// Source: https://openai.com/api/pricing  (June 2025)
// Prices are per 1M tokens.
// ─────────────────────────────────────────────────────────────────────────────

export interface PricingEntry {
  inputCostPer1MTokens: number;
  outputCostPer1MTokens: number;
  contextWindow: number;
  displayName: string;
}

// Prefix-keyed: versioned model ids (e.g. "gpt-4o-2024-11-20") match by prefix.
const TABLE: Record<string, PricingEntry> = {
  // GPT-4o family
  'gpt-4o-mini':   { inputCostPer1MTokens:  0.15, outputCostPer1MTokens:   0.60, contextWindow: 128_000, displayName: 'GPT-4o mini'  },
  'gpt-4o':        { inputCostPer1MTokens:  2.50, outputCostPer1MTokens:  10.00, contextWindow: 128_000, displayName: 'GPT-4o'       },
  // o1 reasoning family
  'o1-mini':       { inputCostPer1MTokens:  3.00, outputCostPer1MTokens:  12.00, contextWindow: 128_000, displayName: 'o1-mini'      },
  'o1':            { inputCostPer1MTokens: 15.00, outputCostPer1MTokens:  60.00, contextWindow: 200_000, displayName: 'o1'           },
  // GPT-4 legacy
  'gpt-4-turbo':   { inputCostPer1MTokens: 10.00, outputCostPer1MTokens:  30.00, contextWindow: 128_000, displayName: 'GPT-4 Turbo'  },
  'gpt-4':         { inputCostPer1MTokens: 30.00, outputCostPer1MTokens:  60.00, contextWindow:   8_192, displayName: 'GPT-4'        },
  // GPT-3.5
  'gpt-3.5-turbo': { inputCostPer1MTokens:  0.50, outputCostPer1MTokens:   1.50, contextWindow:  16_384, displayName: 'GPT-3.5 Turbo' },
};

const FALLBACK: PricingEntry = {
  inputCostPer1MTokens: 2.50,
  outputCostPer1MTokens: 10.00,
  contextWindow: 128_000,
  displayName: 'GPT',
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
