import { z } from "zod";

export const computeProofSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  jobId: z.string().min(1),
  requestHash: z.string().min(1).nullable(),
  responseHash: z.string().min(1).nullable(),
  verificationMode: z.string().min(1).nullable(),
});

export const computeProofStageSchema = z.enum([
  "adjudication",
  "report_synthesis",
  "unknown",
]);

export const computeProofRecordSchema = z.object({
  artifactId: z.string().min(1),
  runId: z.string().min(1),
  signalId: z.string().min(1).nullable(),
  intelId: z.string().min(1).nullable(),
  stage: computeProofStageSchema,
  provider: computeProofSchema.shape.provider,
  model: computeProofSchema.shape.model,
  jobId: computeProofSchema.shape.jobId,
  requestHash: computeProofSchema.shape.requestHash,
  responseHash: computeProofSchema.shape.responseHash,
  verificationMode: computeProofSchema.shape.verificationMode,
  locator: z.string().min(1),
  outputPreview: z.string().min(1),
  recordedAt: z.string().datetime(),
});

export type ComputeProof = z.infer<typeof computeProofSchema>;
export type ComputeProofStage = z.infer<typeof computeProofStageSchema>;
export type ComputeProofRecord = z.infer<typeof computeProofRecordSchema>;
