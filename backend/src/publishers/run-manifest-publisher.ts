import {
  RunManifestBuilder,
  ZeroGClientAdapter,
  ZeroGNamespaceBuilder,
  ZeroGProofRegistry,
  type ZeroGAdapterConfig,
} from "@omen/zero-g";
import type { ProofArtifact, Run, RunProofBundle, ZeroGRunManifest } from "@omen/shared";

type RunManifestPublishResult = {
  manifest: ZeroGRunManifest;
  manifestArtifact: ProofArtifact;
  proofBundle: RunProofBundle;
  artifacts: ProofArtifact[];
  manifestContent: string;
};

export class RunManifestPublisher {
  private readonly adapter: ZeroGClientAdapter;

  private readonly namespaceBuilder = new ZeroGNamespaceBuilder();

  private readonly manifestBuilder = new RunManifestBuilder();

  private readonly proofRegistry = new ZeroGProofRegistry();

  constructor(config: ZeroGAdapterConfig) {
    this.adapter = new ZeroGClientAdapter(config);
  }

  async publish(input: {
    environment: string;
    run: Run;
    artifacts: ProofArtifact[];
  }): Promise<RunManifestPublishResult> {
    this.proofRegistry.registerArtifacts(input.artifacts);

    const manifestPath = this.namespaceBuilder.buildFileBundlePath({
      environment: input.environment,
      scope: "proof",
      runId: input.run.id,
      signalId: input.run.finalSignalId,
      intelId: input.run.finalIntelId,
      segments: ["run-manifests"],
      bundle: "manifest.json",
    });
    const draftManifest = this.manifestBuilder.build({
      environment: input.environment,
      run: input.run,
      artifacts: input.artifacts,
    });

    const draftUpload = await this.requireArtifact(
      this.adapter.uploadFile({
        fileName: manifestPath,
        contentType: "application/json",
        bytes: new TextEncoder().encode(JSON.stringify(draftManifest, null, 2)),
        metadata: {
          artifactType: "run_manifest",
          runId: input.run.id,
          version: draftManifest.version,
        },
      }),
    );
    const draftManifestArtifact = this.manifestBuilder.createManifestArtifact({
      run: input.run,
      uploadArtifact: draftUpload,
    });
    const finalizedManifest = this.manifestBuilder.build({
      environment: input.environment,
      run: input.run,
      artifacts: input.artifacts,
      manifestArtifact: draftManifestArtifact,
    });
    const finalizedContent = JSON.stringify(finalizedManifest, null, 2);
    const finalizedUpload = await this.requireArtifact(
      this.adapter.uploadFile({
        fileName: manifestPath,
        contentType: "application/json",
        bytes: new TextEncoder().encode(finalizedContent),
        metadata: {
          artifactType: "run_manifest",
          runId: input.run.id,
          version: finalizedManifest.version,
        },
      }),
    );
    const manifestArtifact = this.manifestBuilder.createManifestArtifact({
      run: input.run,
      uploadArtifact: finalizedUpload,
    });
    const hydratedManifest = this.manifestBuilder.build({
      environment: input.environment,
      run: input.run,
      artifacts: input.artifacts,
      manifestArtifact,
      createdAt: finalizedManifest.createdAt,
    });
    const proofBundle = this.proofRegistry.attachManifestArtifact(
      input.run.id,
      manifestArtifact,
    );

    return {
      manifest: hydratedManifest,
      manifestArtifact,
      proofBundle,
      artifacts: [...input.artifacts, manifestArtifact],
      manifestContent: JSON.stringify(hydratedManifest, null, 2),
    };
  }

  private async requireArtifact(
    promise: Promise<{ ok: true; value: ProofArtifact } | { ok: false; error: Error }>,
  ) {
    const result = await promise;

    if (!result.ok) {
      throw result.error;
    }

    return result.value;
  }
}
