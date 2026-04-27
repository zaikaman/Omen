import {
  postProofSchema,
  type OutboundPost,
  type PostProofProviderResponse,
  type ProofArtifact,
} from "@omen/shared";
import { ZeroGClientAdapter, ZeroGNamespaceBuilder, type ZeroGAdapterConfig } from "@omen/zero-g";

export class PostProofPublisher {
  private readonly adapter: ZeroGClientAdapter;

  private readonly namespaceBuilder = new ZeroGNamespaceBuilder();

  constructor(config: ZeroGAdapterConfig) {
    this.adapter = new ZeroGClientAdapter(config);
  }

  async publish(input: {
    environment: string;
    post: OutboundPost;
    providerResponse: PostProofProviderResponse | null;
  }): Promise<ProofArtifact[]> {
    const createdAt = new Date().toISOString();
    const proof = postProofSchema.parse({
      postId: input.post.id,
      runId: input.post.runId,
      signalId: input.post.signalId,
      intelId: input.post.intelId,
      payload: input.post.payload,
      providerResponse: input.providerResponse,
      createdAt,
    });
    const baseSegments = ["public-posts", input.post.id];
    const payloadPath = this.namespaceBuilder.buildFileBundlePath({
      environment: input.environment,
      scope: "proof",
      runId: input.post.runId,
      signalId: input.post.signalId,
      intelId: input.post.intelId,
      segments: baseSegments,
      bundle: "payload.json",
    });
    const resultPath = this.namespaceBuilder.buildFileBundlePath({
      environment: input.environment,
      scope: "proof",
      runId: input.post.runId,
      signalId: input.post.signalId,
      intelId: input.post.intelId,
      segments: baseSegments,
      bundle: "provider-result.json",
    });
    const [payloadArtifact, resultArtifact] = await Promise.all([
      this.requireArtifact(
        this.adapter.uploadFile({
          fileName: payloadPath,
          contentType: "application/json",
          bytes: new TextEncoder().encode(JSON.stringify(proof.payload, null, 2)),
          metadata: {
            artifactType: "post_payload",
            postId: input.post.id,
            provider: input.post.provider,
          },
        }),
      ),
      this.requireArtifact(
        this.adapter.uploadFile({
          fileName: resultPath,
          contentType: "application/json",
          bytes: new TextEncoder().encode(JSON.stringify(proof, null, 2)),
          metadata: {
            artifactType: "post_result",
            postId: input.post.id,
            provider: input.post.provider,
            status: input.post.status,
            publishedUrl: input.post.publishedUrl,
          },
        }),
      ),
    ]);

    return [
      {
        ...payloadArtifact,
        id: `${input.post.id}:payload`,
        refType: "post_payload",
        runId: input.post.runId,
        signalId: input.post.signalId,
        intelId: input.post.intelId,
        key: payloadPath,
        createdAt,
      },
      {
        ...resultArtifact,
        id: `${input.post.id}:result`,
        refType: "post_result",
        runId: input.post.runId,
        signalId: input.post.signalId,
        intelId: input.post.intelId,
        key: resultPath,
        createdAt,
      },
    ];
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
