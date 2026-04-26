import { z } from "zod";

import {
  orchestrationContextSchema,
  candidateStateSchema,
  evidenceItemSchema,
} from "./common.js";

export const chartVisionTimeframeSchema = z.enum(["15m", "1h", "4h"]);

export const chartVisionFrameSchema = z.object({
  timeframe: chartVisionTimeframeSchema,
  analysis: z.string().min(1),
  chartDescription: z.string().min(1),
  imageMimeType: z.string().min(1),
  imageWidth: z.number().int().min(1),
  imageHeight: z.number().int().min(1),
});

export const chartVisionInputSchema = z.object({
  context: orchestrationContextSchema,
  candidate: candidateStateSchema,
});

export const chartVisionOutputSchema = z.object({
  candidate: candidateStateSchema,
  frames: z.array(chartVisionFrameSchema).min(1),
  chartSummary: z.string().min(1),
  evidence: z.array(evidenceItemSchema).min(1),
  missingDataNotes: z.array(z.string().min(1)).default([]),
});

export type ChartVisionInput = z.infer<typeof chartVisionInputSchema>;
export type ChartVisionOutput = z.infer<typeof chartVisionOutputSchema>;
