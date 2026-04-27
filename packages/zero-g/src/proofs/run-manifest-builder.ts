import {
  proofArtifactSchema,
  zeroGRunManifestSchema,
  type ProofArtifact,
  type Run,
  type ZeroGArtifactLink,
  type ZeroGRunManifest,
} from "@omen/shared";

import {
  createZeroGArtifactLink,
  zeroGManifestableProofArtifactSchema,
} from "./proof-types.js";
import { ZeroGNamespaceBuilder } from "../storage/namespace.js";

const toLabel = (artifact: ProofArtifact) => {
  const rawLabel =
    typeof artifact.metadata.label === "string" && artifact.metadata.label.trim().length > 0
      ? artifact.metadata.label
      : artifact.refType;

  return `${rawLabel}:${artifact.id}`;
};

export class RunManifestBuilder {
  private readonly namespaceBuilder = new ZeroGNamespaceBuilder();

  build(input: {
    environment: string;
    run: Run;
    artifacts: ProofArtifact[];
    manifestArtifact?: ProofArtifact | null;
    createdAt?: string;
  }): ZeroGRunManifest {
    const createdAt = input.createdAt ?? new Date().toISOString();
    const namespace = this.namespaceBuilder.describe({
      environment: input.environment,
      scope: "proof",
      runId: input.run.id,
      signalId: input.run.finalSignalId,
      intelId: input.run.finalIntelId,
      segments: ["run-manifests"],
    });
    const relatedArtifacts = this.toLinks(input.artifacts);
    const manifestArtifact =
      input.manifestArtifact
        ? this.createManifestLink(input.manifestArtifact)
        : null;

    return zeroGRunManifestSchema.parse({
      id: `${input.run.id}:manifest:v1`,
      runId: input.run.id,
      version: 1,
      namespace,
      manifestArtifact,
      checkpoints: relatedArtifacts.filter((link) => link.category === "mutable_state"),
      logs: relatedArtifacts.filter((link) => link.category === "immutable_log"),
      files: relatedArtifacts.filter((link) => link.category === "file_bundle"),
      computeProofs: relatedArtifacts.filter((link) => link.category === "compute_proof"),
      publicPosts: relatedArtifacts.filter((link) => link.category === "public_post"),
      chainAnchors: relatedArtifacts.filter((link) => link.category === "chain_anchor"),
      relatedArtifacts,
      summary: {
        status: input.run.status,
        finalSignalId: input.run.finalSignalId,
        finalIntelId: input.run.finalIntelId,
        checkpointCount: relatedArtifacts.filter((link) => link.category === "mutable_state").length,
        artifactCount: relatedArtifacts.length + (manifestArtifact ? 1 : 0),
      },
      createdAt,
    });
  }

  createManifestArtifact(input: {
    run: Run;
    uploadArtifact: ProofArtifact;
    createdAt?: string;
  }): ProofArtifact {
    const uploadArtifact = proofArtifactSchema.parse(input.uploadArtifact);

    return proofArtifactSchema.parse({
      id: `${input.run.id}:manifest`,
      runId: input.run.id,
      signalId: input.run.finalSignalId,
      intelId: input.run.finalIntelId,
      refType: "manifest",
      key: uploadArtifact.key,
      locator: uploadArtifact.locator,
      metadata: {
        ...uploadArtifact.metadata,
        sourceArtifactId: uploadArtifact.id,
        sourceRefType: uploadArtifact.refType,
      },
      compute: null,
      createdAt: input.createdAt ?? uploadArtifact.createdAt,
    });
  }

  private toLinks(artifacts: ProofArtifact[]): ZeroGArtifactLink[] {
    return artifacts
      .map((artifact) => zeroGManifestableProofArtifactSchema.parse(artifact))
      .map((artifact) =>
        createZeroGArtifactLink({
          label: toLabel(artifact),
          namespacePath: artifact.key,
          artifact,
        }),
      )
      .sort((left, right) => left.artifact.createdAt.localeCompare(right.artifact.createdAt));
  }

  private createManifestLink(artifact: ProofArtifact) {
    return createZeroGArtifactLink({
      label: `manifest:${artifact.id}`,
      namespacePath: artifact.key,
      artifact,
    });
  }
}
