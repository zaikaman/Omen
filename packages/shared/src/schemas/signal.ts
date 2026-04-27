import { z } from "zod";

import {
  CRITIC_DECISION_VALUES,
  REPORT_STATUS_VALUES,
  SIGNAL_DIRECTION_VALUES,
  SIGNAL_STATUS_VALUES,
} from "../constants/index.js";

export const signalDirectionSchema = z.enum(SIGNAL_DIRECTION_VALUES);

export const criticDecisionSchema = z.enum(CRITIC_DECISION_VALUES);

export const reportStatusSchema = z.enum(REPORT_STATUS_VALUES);

export const signalStatusSchema = z.enum(SIGNAL_STATUS_VALUES);

export const priceBandSchema = z.object({
  low: z.number(),
  high: z.number(),
  rationale: z.string().min(1).nullable(),
});

export const priceTargetSchema = z.object({
  label: z.string().min(1),
  price: z.number(),
});

export const signalBaseSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  candidateId: z.string().min(1).nullable(),
  asset: z.string().min(1),
  direction: signalDirectionSchema,
  confidence: z.number().int().min(0).max(100),
  orderType: z.enum(["market", "limit"]).nullable().default(null),
  tradingStyle: z.enum(["day_trade", "swing_trade"]).nullable().default(null),
  expectedDuration: z.string().min(1).nullable().default(null),
  currentPrice: z.number().positive().nullable().default(null),
  entryPrice: z.number().positive().nullable().default(null),
  targetPrice: z.number().positive().nullable().default(null),
  stopLoss: z.number().positive().nullable().default(null),
  signalStatus: signalStatusSchema.nullable().default(null),
  pnlPercent: z.number().nullable().default(null),
  closedAt: z.string().datetime().nullable().default(null),
  priceUpdatedAt: z.string().datetime().nullable().default(null),
  riskReward: z.number().min(0).nullable(),
  entryZone: priceBandSchema.nullable(),
  invalidation: priceBandSchema.nullable(),
  targets: z.array(priceTargetSchema).default([]),
  whyNow: z.string().min(1),
  confluences: z.array(z.string().min(1)).default([]),
  uncertaintyNotes: z.string().min(1),
  missingDataNotes: z.string().min(1),
  criticDecision: criticDecisionSchema,
  reportStatus: reportStatusSchema,
  finalReportRefId: z.string().min(1).nullable(),
  proofRefIds: z.array(z.string().min(1)).default([]),
  disclaimer: z.string().min(1),
  publishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const signalSchema = signalBaseSchema.superRefine((signal, ctx) => {
    const actionable =
      signal.direction === "LONG" || signal.direction === "SHORT";

    if (actionable && signal.confidence < 85) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "actionable signals require confidence >= 85",
        path: ["confidence"],
      });
    }

    if (actionable && (signal.riskReward ?? 0) < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "actionable signals require riskReward >= 2",
        path: ["riskReward"],
      });
    }
});

export const signalListItemSchema = signalBaseSchema.pick({
  id: true,
  runId: true,
  asset: true,
  direction: true,
  confidence: true,
  currentPrice: true,
  entryPrice: true,
  targetPrice: true,
  stopLoss: true,
  signalStatus: true,
  pnlPercent: true,
  riskReward: true,
  entryZone: true,
  invalidation: true,
  targets: true,
  whyNow: true,
  criticDecision: true,
  reportStatus: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type SignalDirection = z.infer<typeof signalDirectionSchema>;
export type CriticDecision = z.infer<typeof criticDecisionSchema>;
export type ReportStatus = z.infer<typeof reportStatusSchema>;
export type SignalStatus = z.infer<typeof signalStatusSchema>;
export type PriceBand = z.infer<typeof priceBandSchema>;
export type PriceTarget = z.infer<typeof priceTargetSchema>;
export type Signal = z.infer<typeof signalSchema>;
export type SignalListItem = z.infer<typeof signalListItemSchema>;
