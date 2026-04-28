import { z } from "zod";

import { orchestrationContextSchema, biasDecisionSchema, candidateStateSchema } from "./common.js";

export const scannerInputSchema = z.object({
  context: orchestrationContextSchema,
  bias: biasDecisionSchema,
  universe: z.array(z.string().min(1)).min(1),
  activeTradeSymbols: z.array(z.string().min(1)).default([]),
});

export const scannerOutputSchema = z.object({
  marketBias: biasDecisionSchema.shape.marketBias,
  candidates: z.array(candidateStateSchema).max(3),
  rejectedSymbols: z.array(z.string().min(1)).default([]),
});

export type ScannerInput = z.infer<typeof scannerInputSchema>;
export type ScannerOutput = z.infer<typeof scannerOutputSchema>;
