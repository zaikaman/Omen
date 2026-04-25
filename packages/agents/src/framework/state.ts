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
  thesisDrafts: z.array(thesisDraftSchema),
  criticReviews: z.array(criticReviewSchema),
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
    thesisDrafts: [],
    criticReviews: [],
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
export type PublisherDraft = z.infer<typeof publisherDraftSchema>;
export type SwarmState = z.infer<typeof swarmStateSchema>;
export type SwarmStateUpdate = z.infer<typeof swarmStateUpdateSchema>;
export type { MarketBias };
