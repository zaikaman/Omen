import { z } from "zod";

import { EVENT_STATUS_VALUES } from "../constants/index.js";

export const agentRoleSchema = z.enum([
  "orchestrator",
  "market_bias",
  "scanner",
  "research",
  "chart_vision",
  "analyst",
  "critic",
  "publisher",
  "memory",
  "monitor",
]);

export const eventStatusSchema = z.enum(EVENT_STATUS_VALUES);

export const agentEventTypeSchema = z.enum([
  "run_created",
  "market_bias_generated",
  "candidate_found",
  "axl_message_sent",
  "axl_message_received",
  "zero_g_kv_write",
  "zero_g_log_append",
  "zero_g_file_published",
  "research_completed",
  "chart_generated",
  "thesis_generated",
  "critic_decision",
  "report_published",
  "intel_ready",
  "post_queued",
  "warning",
  "error",
]);

export const agentNodeSchema = z.object({
  id: z.string().min(1),
  role: agentRoleSchema,
  transport: z.enum(["axl", "local"]),
  status: z.enum(["starting", "online", "degraded", "offline"]),
  peerId: z.string().min(1).nullable(),
  lastHeartbeatAt: z.string().datetime().nullable(),
  lastError: z.string().min(1).nullable(),
  metadata: z.record(z.string(), z.unknown()),
});

export const agentEventSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  agentId: z.string().min(1),
  agentRole: agentRoleSchema,
  eventType: agentEventTypeSchema,
  status: eventStatusSchema,
  summary: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  timestamp: z.string().datetime(),
  correlationId: z.string().min(1).nullable(),
  axlMessageId: z.string().min(1).nullable(),
  proofRefId: z.string().min(1).nullable(),
  signalId: z.string().min(1).nullable(),
  intelId: z.string().min(1).nullable(),
});

export type AgentRole = z.infer<typeof agentRoleSchema>;
export type EventStatus = z.infer<typeof eventStatusSchema>;
export type AgentEventType = z.infer<typeof agentEventTypeSchema>;
export type AgentNode = z.infer<typeof agentNodeSchema>;
export type AgentEvent = z.infer<typeof agentEventSchema>;
