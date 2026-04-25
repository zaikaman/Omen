import { z } from "zod";

export const providerHealthSchema = z.object({
  provider: z.string().min(1),
  available: z.boolean(),
  degraded: z.boolean().default(false),
  checkedAt: z.string().datetime(),
  notes: z.array(z.string().min(1)).default([]),
});

export const marketCandleSchema = z.object({
  timestamp: z.string().datetime(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number().min(0),
});

export const marketSnapshotSchema = z.object({
  symbol: z.string().min(1),
  provider: z.string().min(1),
  price: z.number(),
  change24hPercent: z.number().nullable(),
  volume24h: z.number().nullable(),
  fundingRate: z.number().nullable(),
  openInterest: z.number().nullable(),
  candles: z.array(marketCandleSchema).default([]),
  capturedAt: z.string().datetime(),
});

export const assetNarrativeSchema = z.object({
  symbol: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  sentiment: z.enum(["bullish", "bearish", "neutral"]),
  source: z.string().min(1),
  sourceUrl: z.string().url().nullable(),
  capturedAt: z.string().datetime(),
});

export const protocolSnapshotSchema = z.object({
  protocol: z.string().min(1),
  chain: z.string().min(1),
  tvlUsd: z.number().min(0),
  tvlChange1dPercent: z.number().nullable(),
  tvlChange7dPercent: z.number().nullable(),
  category: z.string().min(1).nullable(),
  sourceUrl: z.string().url().nullable(),
  capturedAt: z.string().datetime(),
});

export const providerErrorSchema = z.object({
  provider: z.string().min(1),
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean(),
  sourceStatus: z.number().int().min(100).max(599).nullable(),
});

export type ProviderResult<TValue> =
  | { ok: true; provider: string; value: TValue; health: z.infer<typeof providerHealthSchema> }
  | {
      ok: false;
      provider: string;
      error: z.infer<typeof providerErrorSchema>;
      health: z.infer<typeof providerHealthSchema>;
    };

export const createProviderSuccess = <TValue>(input: {
  provider: string;
  value: TValue;
  checkedAt?: string;
  notes?: string[];
}): ProviderResult<TValue> => ({
  ok: true,
  provider: input.provider,
  value: input.value,
  health: providerHealthSchema.parse({
    provider: input.provider,
    available: true,
    degraded: false,
    checkedAt: input.checkedAt ?? new Date().toISOString(),
    notes: input.notes ?? [],
  }),
});

export const createProviderFailure = <TValue = never>(input: {
  provider: string;
  code: string;
  message: string;
  retryable: boolean;
  sourceStatus?: number | null;
  checkedAt?: string;
  notes?: string[];
}): ProviderResult<TValue> => ({
  ok: false,
  provider: input.provider,
  error: providerErrorSchema.parse({
    provider: input.provider,
    code: input.code,
    message: input.message,
    retryable: input.retryable,
    sourceStatus: input.sourceStatus ?? null,
  }),
  health: providerHealthSchema.parse({
    provider: input.provider,
    available: false,
    degraded: true,
    checkedAt: input.checkedAt ?? new Date().toISOString(),
    notes: input.notes ?? [],
  }),
});

export type ProviderHealth = z.infer<typeof providerHealthSchema>;
export type MarketCandle = z.infer<typeof marketCandleSchema>;
export type MarketSnapshot = z.infer<typeof marketSnapshotSchema>;
export type AssetNarrative = z.infer<typeof assetNarrativeSchema>;
export type ProtocolSnapshot = z.infer<typeof protocolSnapshotSchema>;
export type ProviderError = z.infer<typeof providerErrorSchema>;
