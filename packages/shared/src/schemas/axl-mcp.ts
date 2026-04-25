import { z } from "zod";

import { agentRoleSchema } from "./event.js";

export const axlMcpMethodSchema = z
  .string()
  .min(1)
  .regex(/^[a-zA-Z0-9._/-]+$/, "AXL MCP methods must use safe routing characters.");

export const axlMcpToolSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  inputSchema: z.record(z.string(), z.unknown()).default({}),
});

export const axlMcpServiceContractSchema = z.object({
  service: z.string().min(1),
  version: z.string().min(1),
  peerId: z.string().min(1).nullable(),
  role: agentRoleSchema,
  description: z.string().min(1),
  methods: z.array(axlMcpMethodSchema).min(1),
  tools: z.array(axlMcpToolSchema).default([]),
  tags: z.array(z.string().min(1)).default([]),
});

export const axlMcpRouteSchema = z.object({
  peerId: z.string().min(1),
  service: z.string().min(1),
  method: axlMcpMethodSchema,
  runId: z.string().min(1).nullable(),
  correlationId: z.string().min(1).nullable(),
  timeoutMs: z.number().int().min(1).nullable(),
});

export const axlMcpRequestSchema = z.object({
  jsonrpc: z.literal("2.0").default("2.0"),
  id: z.union([z.string().min(1), z.number().int()]),
  service: z.string().min(1),
  method: axlMcpMethodSchema,
  params: z.record(z.string(), z.unknown()).default({}),
  context: z
    .object({
      runId: z.string().min(1).nullable(),
      correlationId: z.string().min(1).nullable(),
      callerPeerId: z.string().min(1).nullable(),
      callerRole: agentRoleSchema.nullable(),
    })
    .default({
      runId: null,
      correlationId: null,
      callerPeerId: null,
      callerRole: null,
    }),
});

export const axlMcpErrorSchema = z.object({
  code: z.number().int(),
  message: z.string().min(1),
  data: z.record(z.string(), z.unknown()).default({}),
});

export const axlMcpResponseSchema = z
  .object({
    jsonrpc: z.literal("2.0").default("2.0"),
    id: z.union([z.string().min(1), z.number().int()]),
    result: z.record(z.string(), z.unknown()).optional(),
    error: axlMcpErrorSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.result && !value.error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "AXL MCP responses must include either result or error.",
        path: ["result"],
      });
    }

    if (value.result && value.error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "AXL MCP responses cannot include both result and error.",
        path: ["error"],
      });
    }
  });

export type AxlMcpMethod = z.infer<typeof axlMcpMethodSchema>;
export type AxlMcpTool = z.infer<typeof axlMcpToolSchema>;
export type AxlMcpServiceContract = z.infer<typeof axlMcpServiceContractSchema>;
export type AxlMcpRoute = z.infer<typeof axlMcpRouteSchema>;
export type AxlMcpRequest = z.infer<typeof axlMcpRequestSchema>;
export type AxlMcpError = z.infer<typeof axlMcpErrorSchema>;
export type AxlMcpResponse = z.infer<typeof axlMcpResponseSchema>;
