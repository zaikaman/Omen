import { z } from "zod";

import {
  AXL_DELIVERY_STATUS_VALUES,
  AXL_TRANSPORT_KIND_VALUES,
} from "../constants/index.js";
import { agentRoleSchema } from "./event.js";

export const axlTransportKindSchema = z.enum(AXL_TRANSPORT_KIND_VALUES);

export const axlDeliveryStatusSchema = z.enum(AXL_DELIVERY_STATUS_VALUES);

export const axlEnvelopeSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  correlationId: z.string().min(1),
  fromAgentId: z.string().min(1),
  fromRole: agentRoleSchema,
  toAgentId: z.string().min(1).nullable(),
  toRole: agentRoleSchema.nullable(),
  topic: z.string().min(1).nullable(),
  messageType: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  transportKind: axlTransportKindSchema,
  deliveryStatus: axlDeliveryStatusSchema,
  durableRefId: z.string().min(1).nullable(),
  timestamp: z.string().datetime(),
});

export const axlPeerStatusSchema = z.object({
  peerId: z.string().min(1),
  role: agentRoleSchema,
  status: z.enum(["online", "degraded", "offline"]),
  services: z.array(z.string().min(1)).default([]),
  lastSeenAt: z.string().datetime(),
  latencyMs: z.number().int().min(0).nullable(),
});

export type AxlTransportKind = z.infer<typeof axlTransportKindSchema>;
export type AxlDeliveryStatus = z.infer<typeof axlDeliveryStatusSchema>;
export type AxlEnvelope = z.infer<typeof axlEnvelopeSchema>;
export type AxlPeerStatus = z.infer<typeof axlPeerStatusSchema>;
