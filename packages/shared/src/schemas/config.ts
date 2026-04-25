import { z } from "zod";

import { RUNTIME_MODE_VALUES } from "../constants/index.js";

export const providerToggleSchema = z.object({
  enabled: z.boolean(),
  required: z.boolean(),
});

export const runtimeConfigSchema = z.object({
  id: z.string().min(1),
  mode: z.enum(RUNTIME_MODE_VALUES),
  marketUniverse: z.array(z.string().min(1)).min(1),
  qualityThresholds: z.object({
    minConfidence: z.number().min(0).max(100),
    minRiskReward: z.number().min(0),
    minConfluences: z.number().int().min(0),
  }),
  providers: z.object({
    axl: providerToggleSchema,
    zeroGStorage: providerToggleSchema,
    zeroGCompute: providerToggleSchema,
    binance: providerToggleSchema,
    coinGecko: providerToggleSchema,
    defiLlama: providerToggleSchema,
    news: providerToggleSchema,
    twitterapi: providerToggleSchema,
  }),
  paperTradingEnabled: z.boolean(),
  testnetExecutionEnabled: z.boolean(),
  mainnetExecutionEnabled: z.boolean(),
  postToXEnabled: z.boolean(),
  scanIntervalMinutes: z.number().int().min(1),
  updatedAt: z.string().datetime(),
});

export type ProviderToggle = z.infer<typeof providerToggleSchema>;
export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;
