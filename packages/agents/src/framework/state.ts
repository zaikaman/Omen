import { z } from "zod";

import {
  agentEventSchema,
  axlEnvelopeSchema,
  outboundPostSchema,
  proofArtifactSchema,
  runSchema,
  runtimeConfigSchema,
} from "@omen/shared";
import type { MarketBias } from "@omen/shared";
import { intelCategorySchema } from "@omen/shared";

export const candidateStateSchema = z.object({
  id: z.string().min(1),
  symbol: z.string().min(1),
  reason: z.string().min(1),
  directionHint: z.enum(["LONG", "SHORT", "WATCHLIST"]).nullable(),
  status: z.enum(["pending", "researched", "rejected", "promoted"]),
  sourceUniverse: z.string().min(1),
  dedupeKey: z.string().min(1),
  missingDataNotes: z.array(z.string().min(1)).default([]),
});

export const evidenceItemSchema = z.object({
  category: z.enum([
    "market",
    "technical",
    "liquidity",
    "funding",
    "fundamental",
    "catalyst",
    "sentiment",
    "chart",
  ]),
  summary: z.string().min(1),
  sourceLabel: z.string().min(1),
  sourceUrl: z.string().url().nullable(),
  structuredData: z.record(z.string(), z.unknown()).default({}),
});

export const thesisDraftSchema = z.object({
  candidateId: z.string().min(1),
  asset: z.string().min(1),
  direction: z.enum(["LONG", "SHORT", "WATCHLIST", "NONE"]),
  confidence: z.number().int().min(0).max(100),
  orderType: z.enum(["market", "limit"]).nullable().default(null),
  tradingStyle: z.enum(["day_trade", "swing_trade"]).nullable().default(null),
  expectedDuration: z.string().min(1).nullable().default(null),
  currentPrice: z.number().positive().nullable().default(null),
  entryPrice: z.number().positive().nullable().default(null),
  targetPrice: z.number().positive().nullable().default(null),
  stopLoss: z.number().positive().nullable().default(null),
  riskReward: z.number().min(0).nullable(),
  whyNow: z.string().min(1),
  confluences: z.array(z.string().min(1)).default([]),
  uncertaintyNotes: z.string().min(1),
  missingDataNotes: z.string().min(1),
});

export const criticReviewSchema = z.object({
  candidateId: z.string().min(1),
  decision: z.enum(["approved", "rejected", "watchlist_only"]),
  objections: z.array(z.string().min(1)).default([]),
  forcedOutcomeReason: z.string().min(1).nullable(),
});

export const intelReportSchema = z.object({
  topic: z.string().min(1),
  insight: z.string().min(1),
  importanceScore: z.number().int().min(1).max(10),
  category: intelCategorySchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  confidence: z.number().int().min(0).max(100),
  symbols: z.array(z.string().min(1)).default([]),
  imagePrompt: z.string().min(1).nullable().default(null),
});

export const intelArticleSchema = z.object({
  headline: z.string().min(1),
  content: z.string().min(1),
  tldr: z.string().min(1),
});

export const generatedIntelContentSchema = z.object({
  topic: z.string().min(1).nullable().default(null),
  tweetText: z.string().min(1).max(280).nullable().default(null),
  blogPost: z.string().min(1).nullable().default(null),
  imagePrompt: z.string().min(1).nullable().default(null),
  formattedContent: z.string().min(1).nullable().default(null),
  logMessage: z.string().min(1).nullable().default(null),
});

export const recentIntelHistoryItemSchema = z.object({
  title: z.string().min(1),
  topic: z.string().min(1),
  category: intelCategorySchema,
  symbols: z.array(z.string().min(1)).default([]),
  timestamp: z.string().datetime(),
});

export const recentPostContextItemSchema = z.object({
  kind: z.enum(["signal_alert", "intel_summary", "intel_thread"]),
  text: z.string().min(1),
  status: z.string().min(1),
  publishedUrl: z.string().url().nullable(),
  signalId: z.string().min(1).nullable(),
  intelId: z.string().min(1).nullable(),
  timestamp: z.string().datetime(),
});

export const publisherDraftSchema = z.object({
  kind: z.enum(["signal_alert", "intel_summary", "intel_thread", "no_conviction"]),
  headline: z.string().min(1),
  summary: z.string().min(1),
  text: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const swarmStateSchema = z.object({
  run: runSchema,
  config: runtimeConfigSchema,
  marketBiasReasoning: z.string().min(1).nullable(),
  activeCandidates: z.array(candidateStateSchema).max(3),
  evidenceItems: z.array(evidenceItemSchema),
  chartVisionSummaries: z.array(z.string().min(1)),
  thesisDrafts: z.array(thesisDraftSchema),
  criticReviews: z.array(criticReviewSchema),
  intelReports: z.array(intelReportSchema),
  generatedIntelContents: z.array(generatedIntelContentSchema),
  intelArticles: z.array(intelArticleSchema),
  recentIntelHistory: z.array(recentIntelHistoryItemSchema),
  recentPostContext: z.array(recentPostContextItemSchema),
  publisherDrafts: z.array(publisherDraftSchema),
  events: z.array(agentEventSchema),
  axlMessages: z.array(axlEnvelopeSchema),
  proofArtifacts: z.array(proofArtifactSchema),
  outboundPosts: z.array(outboundPostSchema),
  latestCheckpointRefId: z.string().min(1).nullable(),
  notes: z.array(z.string().min(1)),
  errors: z.array(z.string().min(1)),
});

export const swarmStateUpdateSchema = swarmStateSchema.partial();

export const createInitialSwarmState = (input: {
  run: z.infer<typeof runSchema>;
  config: z.infer<typeof runtimeConfigSchema>;
}) =>
  swarmStateSchema.parse({
    run: input.run,
    config: input.config,
    marketBiasReasoning: null,
    activeCandidates: [],
    evidenceItems: [],
    chartVisionSummaries: [],
    thesisDrafts: [],
    criticReviews: [],
    intelReports: [],
    generatedIntelContents: [],
    intelArticles: [],
    recentIntelHistory: [],
    recentPostContext: [],
    publisherDrafts: [],
    events: [],
    axlMessages: [],
    proofArtifacts: [],
    outboundPosts: [],
    latestCheckpointRefId: null,
    notes: [],
    errors: [],
  });

export const mergeSwarmState = (
  state: z.infer<typeof swarmStateSchema>,
  update: z.infer<typeof swarmStateUpdateSchema>,
) => swarmStateSchema.parse({ ...state, ...update });

export type CandidateState = z.infer<typeof candidateStateSchema>;
export type EvidenceItem = z.infer<typeof evidenceItemSchema>;
export type ThesisDraft = z.infer<typeof thesisDraftSchema>;
export type CriticReview = z.infer<typeof criticReviewSchema>;
export type IntelReport = z.infer<typeof intelReportSchema>;
export type GeneratedIntelContent = z.infer<typeof generatedIntelContentSchema>;
export type IntelArticle = z.infer<typeof intelArticleSchema>;
export type RecentIntelHistoryItem = z.infer<typeof recentIntelHistoryItemSchema>;
export type RecentPostContextItem = z.infer<typeof recentPostContextItemSchema>;
export type PublisherDraft = z.infer<typeof publisherDraftSchema>;
export type SwarmState = z.infer<typeof swarmStateSchema>;
export type SwarmStateUpdate = z.infer<typeof swarmStateUpdateSchema>;
export type { MarketBias };
