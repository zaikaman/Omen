import { z } from "zod";

import { agentRoleSchema } from "./event.js";

export const axlA2ATaskStateSchema = z.enum([
  "accepted",
  "running",
  "completed",
  "failed",
]);

export const axlA2ADelegationRequestSchema = z.object({
  delegationId: z.string().min(1),
  runId: z.string().min(1),
  correlationId: z.string().min(1),
  fromPeerId: z.string().min(1),
  fromRole: agentRoleSchema,
  toPeerId: z.string().min(1).nullable(),
  requestedRole: agentRoleSchema,
  taskType: z.string().min(1),
  requiredServices: z.array(z.string().min(1)).default([]),
  payload: z.record(z.string(), z.unknown()).default({}),
  timeoutMs: z.number().int().min(1).nullable(),
  routeHints: z.array(z.string().min(1)).default([]),
});

export const axlA2AAcceptedResponseSchema = z.object({
  delegationId: z.string().min(1),
  state: z.literal("accepted"),
  assignedPeerId: z.string().min(1),
  assignedRole: agentRoleSchema,
  acceptedAt: z.string().datetime(),
});

export const axlA2AResultSchema = z.object({
  delegationId: z.string().min(1),
  state: axlA2ATaskStateSchema,
  responderPeerId: z.string().min(1),
  responderRole: agentRoleSchema,
  output: z.record(z.string(), z.unknown()).default({}),
  error: z.string().min(1).nullable(),
  completedAt: z.string().datetime().nullable(),
});

export const axlA2ADelegationEnvelopeSchema = z.object({
  request: axlA2ADelegationRequestSchema,
  receipt: axlA2AAcceptedResponseSchema.nullable(),
  result: axlA2AResultSchema.nullable(),
});

export type AxlA2ATaskState = z.infer<typeof axlA2ATaskStateSchema>;
export type AxlA2ADelegationRequest = z.infer<
  typeof axlA2ADelegationRequestSchema
>;
export type AxlA2AAcceptedResponse = z.infer<
  typeof axlA2AAcceptedResponseSchema
>;
export type AxlA2AResult = z.infer<typeof axlA2AResultSchema>;
export type AxlA2ADelegationEnvelope = z.infer<
  typeof axlA2ADelegationEnvelopeSchema
>;
