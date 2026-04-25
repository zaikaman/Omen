import { z } from "zod";

import { proofArtifactSchema } from "./proofs.js";
import { runStatusSchema } from "./run.js";

export const zeroGNamespaceScopeSchema = z.enum([
  "runtime",
  "run",
  "signal",
  "intel",
  "system",
  "proof",
]);

export const zeroGNamespaceDescriptorSchema = z.object({
  app: z.literal("omen"),
  environment: z.string().min(1),
  scope: zeroGNamespaceScopeSchema,
  runId: z.string().min(1).nullable(),
  signalId: z.string().min(1).nullable(),
  intelId: z.string().min(1).nullable(),
  segments: z.array(z.string().min(1)).default([]),
  path: z.string().min(1),
});

export const zeroGArtifactCategorySchema = z.enum([
  "mutable_state",
  "immutable_log",
  "file_bundle",
  "compute_proof",
  "manifest",
  "chain_anchor",
]);

export const zeroGArtifactLinkSchema = z.object({
  label: z.string().min(1),
  category: zeroGArtifactCategorySchema,
  namespacePath: z.string().min(1).nullable(),
  artifact: proofArtifactSchema,
});

export const zeroGMutableStateLinkSchema = zeroGArtifactLinkSchema
  .extend({
    category: z.literal("mutable_state"),
  })
  .refine(({ artifact }) => artifact.refType === "kv_state", {
    message: "Mutable state links must point to 0G KV artifacts.",
    path: ["artifact", "refType"],
  });

export const zeroGImmutableLogLinkSchema = zeroGArtifactLinkSchema
  .extend({
    category: z.literal("immutable_log"),
  })
  .refine(
    ({ artifact }) =>
      artifact.refType === "log_entry" || artifact.refType === "log_bundle",
    {
      message: "Immutable log links must point to 0G log artifacts.",
      path: ["artifact", "refType"],
    },
  );

export const zeroGFileBundleLinkSchema = zeroGArtifactLinkSchema
  .extend({
    category: z.literal("file_bundle"),
  })
  .refine(({ artifact }) => artifact.refType === "file_artifact", {
    message: "File bundle links must point to 0G file artifacts.",
    path: ["artifact", "refType"],
  });

export const zeroGComputeProofLinkSchema = zeroGArtifactLinkSchema
  .extend({
    category: z.literal("compute_proof"),
  })
  .superRefine(({ artifact }, ctx) => {
    if (
      artifact.refType !== "compute_job" &&
      artifact.refType !== "compute_result"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Compute proof links must point to 0G compute artifacts.",
        path: ["artifact", "refType"],
      });
    }

    if (!artifact.compute) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Compute proof links require compute metadata.",
        path: ["artifact", "compute"],
      });
    }
  });

export const zeroGManifestArtifactLinkSchema = zeroGArtifactLinkSchema
  .extend({
    category: z.literal("manifest"),
  })
  .refine(({ artifact }) => artifact.refType === "manifest", {
    message: "Manifest links must point to manifest artifacts.",
    path: ["artifact", "refType"],
  });

export const zeroGChainAnchorLinkSchema = zeroGArtifactLinkSchema
  .extend({
    category: z.literal("chain_anchor"),
  })
  .refine(({ artifact }) => artifact.refType === "chain_proof", {
    message: "Chain anchors must point to chain proof artifacts.",
    path: ["artifact", "refType"],
  });

export const zeroGManifestSummarySchema = z.object({
  status: runStatusSchema,
  finalSignalId: z.string().min(1).nullable(),
  finalIntelId: z.string().min(1).nullable(),
  checkpointCount: z.number().int().min(0),
  artifactCount: z.number().int().min(0),
});

export const zeroGRunManifestSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  version: z.literal(1),
  namespace: zeroGNamespaceDescriptorSchema,
  manifestArtifact: zeroGManifestArtifactLinkSchema.nullable(),
  checkpoints: z.array(zeroGMutableStateLinkSchema).default([]),
  logs: z.array(zeroGImmutableLogLinkSchema).default([]),
  files: z.array(zeroGFileBundleLinkSchema).default([]),
  computeProofs: z.array(zeroGComputeProofLinkSchema).default([]),
  chainAnchors: z.array(zeroGChainAnchorLinkSchema).default([]),
  relatedArtifacts: z.array(zeroGArtifactLinkSchema).default([]),
  summary: zeroGManifestSummarySchema,
  createdAt: z.string().datetime(),
});

export type ZeroGNamespaceScope = z.infer<typeof zeroGNamespaceScopeSchema>;
export type ZeroGNamespaceDescriptor = z.infer<
  typeof zeroGNamespaceDescriptorSchema
>;
export type ZeroGArtifactCategory = z.infer<typeof zeroGArtifactCategorySchema>;
export type ZeroGArtifactLink = z.infer<typeof zeroGArtifactLinkSchema>;
export type ZeroGMutableStateLink = z.infer<typeof zeroGMutableStateLinkSchema>;
export type ZeroGImmutableLogLink = z.infer<typeof zeroGImmutableLogLinkSchema>;
export type ZeroGFileBundleLink = z.infer<typeof zeroGFileBundleLinkSchema>;
export type ZeroGComputeProofLink = z.infer<
  typeof zeroGComputeProofLinkSchema
>;
export type ZeroGManifestArtifactLink = z.infer<
  typeof zeroGManifestArtifactLinkSchema
>;
export type ZeroGChainAnchorLink = z.infer<typeof zeroGChainAnchorLinkSchema>;
export type ZeroGManifestSummary = z.infer<typeof zeroGManifestSummarySchema>;
export type ZeroGRunManifest = z.infer<typeof zeroGRunManifestSchema>;
