import { z } from "zod";

import { PROOF_REF_TYPE_VALUES } from "../constants/index.js";

export const proofRefTypeSchema = z.enum(PROOF_REF_TYPE_VALUES);

export const computeProofSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  jobId: z.string().min(1),
  requestHash: z.string().min(1).nullable(),
  responseHash: z.string().min(1).nullable(),
  verificationMode: z.string().min(1).nullable(),
});

export const proofArtifactSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  signalId: z.string().min(1).nullable(),
  intelId: z.string().min(1).nullable(),
  refType: proofRefTypeSchema,
  key: z.string().min(1).nullable(),
  locator: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()),
  compute: computeProofSchema.nullable(),
  createdAt: z.string().datetime(),
});

export const runProofBundleSchema = z.object({
  runId: z.string().min(1),
  manifestRefId: z.string().min(1).nullable(),
  artifactRefs: z.array(proofArtifactSchema),
});

export type ProofRefType = z.infer<typeof proofRefTypeSchema>;
export type ComputeProof = z.infer<typeof computeProofSchema>;
export type ProofArtifact = z.infer<typeof proofArtifactSchema>;
export type RunProofBundle = z.infer<typeof runProofBundleSchema>;
