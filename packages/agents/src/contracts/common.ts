import { z } from "zod";

import { agentRoleSchema, marketBiasSchema, runtimeModeSchema } from "@omen/shared";

import {
  candidateStateSchema,
  criticReviewSchema,
  evidenceItemSchema,
  publisherDraftSchema,
  thesisDraftSchema,
} from "../framework/state.js";

export const orchestrationContextSchema = z.object({
  runId: z.string().min(1),
  threadId: z.string().min(1),
  mode: runtimeModeSchema,
  triggeredBy: z.enum(["dashboard", "scheduler", "system"]),
});

export const agentToolPolicySchema = z.object({
  marketData: z.boolean(),
  axlMessaging: z.boolean(),
  zeroGMemory: z.boolean(),
  xPosting: z.boolean(),
});

export const roleDescriptorSchema = z.object({
  agentId: z.string().min(1),
  role: agentRoleSchema,
  description: z.string().min(1),
  toolPolicy: agentToolPolicySchema,
});

export const biasDecisionSchema = z.object({
  marketBias: marketBiasSchema,
  reasoning: z.string().min(1),
  confidence: z.number().int().min(0).max(100),
});

export const researchBundleSchema = z.object({
  candidate: candidateStateSchema,
  evidence: z.array(evidenceItemSchema).min(1),
  narrativeSummary: z.string().min(1),
  missingDataNotes: z.array(z.string().min(1)).default([]),
});

export const thesisEvaluationSchema = z.object({
  thesis: thesisDraftSchema,
  evidence: z.array(evidenceItemSchema).min(1),
});

export const publicationPacketSchema = z.object({
  drafts: z.array(publisherDraftSchema).min(1),
  approvedReview: criticReviewSchema.nullable(),
});

export {
  candidateStateSchema,
  criticReviewSchema,
  evidenceItemSchema,
  publisherDraftSchema,
  thesisDraftSchema,
};

export type OrchestrationContext = z.infer<typeof orchestrationContextSchema>;
export type AgentToolPolicy = z.infer<typeof agentToolPolicySchema>;
export type RoleDescriptor = z.infer<typeof roleDescriptorSchema>;
export type BiasDecision = z.infer<typeof biasDecisionSchema>;
export type ResearchBundle = z.infer<typeof researchBundleSchema>;
export type ThesisEvaluation = z.infer<typeof thesisEvaluationSchema>;
export type PublicationPacket = z.infer<typeof publicationPacketSchema>;
