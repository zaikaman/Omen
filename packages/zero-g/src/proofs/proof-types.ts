import {
  proofArtifactSchema,
  zeroGArtifactLinkSchema,
} from "@omen/shared";
import type {
  ProofArtifact,
  ZeroGArtifactCategory,
  ZeroGArtifactLink,
} from "@omen/shared";
import type { z } from "zod";

export const zeroGManifestableProofArtifactSchema = proofArtifactSchema.refine(
  (artifact) =>
    artifact.refType === "kv_state" ||
    artifact.refType === "log_entry" ||
    artifact.refType === "log_bundle" ||
    artifact.refType === "file_artifact" ||
    artifact.refType === "compute_job" ||
    artifact.refType === "compute_result" ||
    artifact.refType === "manifest" ||
    artifact.refType === "chain_proof",
  {
    message: "Artifact type is not supported by the 0G manifest contract.",
  },
);

export function categorizeProofArtifact(
  artifact: ProofArtifact,
): ZeroGArtifactCategory {
  const parsed = zeroGManifestableProofArtifactSchema.parse(artifact);

  switch (parsed.refType) {
    case "kv_state":
      return "mutable_state";
    case "log_entry":
    case "log_bundle":
      return "immutable_log";
    case "file_artifact":
      return "file_bundle";
    case "compute_job":
    case "compute_result":
      return "compute_proof";
    case "manifest":
      return "manifest";
    case "chain_proof":
      return "chain_anchor";
  }

  throw new Error(`Unsupported manifest artifact type: ${parsed.refType}`);
}

export function createZeroGArtifactLink(input: {
  label: string;
  namespacePath?: string | null;
  artifact: ProofArtifact;
}): ZeroGArtifactLink {
  return zeroGArtifactLinkSchema.parse({
    label: input.label,
    category: categorizeProofArtifact(input.artifact),
    namespacePath: input.namespacePath ?? null,
    artifact: input.artifact,
  });
}

export type ZeroGManifestableProofArtifact = z.infer<
  typeof zeroGManifestableProofArtifactSchema
>;
