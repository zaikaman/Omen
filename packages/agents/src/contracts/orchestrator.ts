import { z } from "zod";

import { runtimeConfigSchema } from "@omen/shared";

import { orchestrationContextSchema, roleDescriptorSchema } from "./common.js";

export const orchestratorInputSchema = z.object({
  context: orchestrationContextSchema,
  config: runtimeConfigSchema,
  availableRoles: z.array(roleDescriptorSchema).min(1),
});

export const orchestratorOutputSchema = z.object({
  plan: z.array(
    z.object({
      step: z.string().min(1),
      ownerRole: roleDescriptorSchema.shape.role,
      reason: z.string().min(1),
    }),
  ),
  nextNodeKey: z.string().min(1),
  notes: z.array(z.string().min(1)).default([]),
});

export type OrchestratorInput = z.infer<typeof orchestratorInputSchema>;
export type OrchestratorOutput = z.infer<typeof orchestratorOutputSchema>;
