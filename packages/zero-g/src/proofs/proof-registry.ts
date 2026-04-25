import {
  proofArtifactSchema,
  runProofBundleSchema,
  type ProofArtifact,
  type RunProofBundle,
} from "@omen/shared";

export class ZeroGProofRegistry {
  private readonly artifactsByRun = new Map<string, Map<string, ProofArtifact>>();

  registerArtifact(artifact: ProofArtifact) {
    const parsed = proofArtifactSchema.parse(artifact);
    const runArtifacts = this.getOrCreateRunArtifacts(parsed.runId);
    runArtifacts.set(parsed.id, parsed);
    return parsed;
  }

  registerArtifacts(artifacts: ProofArtifact[]) {
    return artifacts.map((artifact) => this.registerArtifact(artifact));
  }

  listArtifacts(runId: string) {
    return Array.from(this.getOrCreateRunArtifacts(runId).values()).sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    );
  }

  getArtifact(runId: string, artifactId: string) {
    return this.getOrCreateRunArtifacts(runId).get(artifactId) ?? null;
  }

  buildBundle(input: {
    runId: string;
    manifestRefId?: string | null;
  }): RunProofBundle {
    return runProofBundleSchema.parse({
      runId: input.runId,
      manifestRefId: input.manifestRefId ?? null,
      artifactRefs: this.listArtifacts(input.runId),
    });
  }

  attachManifestArtifact(runId: string, artifact: ProofArtifact) {
    const parsed = this.registerArtifact(artifact);

    if (parsed.refType !== "manifest") {
      throw new Error("Manifest attachment requires a manifest proof artifact.");
    }

    return this.buildBundle({
      runId,
      manifestRefId: parsed.id,
    });
  }

  private getOrCreateRunArtifacts(runId: string) {
    const existing = this.artifactsByRun.get(runId);

    if (existing) {
      return existing;
    }

    const created = new Map<string, ProofArtifact>();
    this.artifactsByRun.set(runId, created);
    return created;
  }
}
