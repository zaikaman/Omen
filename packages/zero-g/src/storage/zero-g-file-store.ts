import { proofArtifactSchema, type ProofArtifact, type ZeroGNamespaceScope } from "@omen/shared";

import type { ZeroGAdapter } from "../adapters/zero-g-adapter.js";
import { ZeroGNamespaceBuilder } from "./namespace.js";

export class ZeroGFileStore {
  private readonly namespaceBuilder = new ZeroGNamespaceBuilder();

  constructor(private readonly adapter: ZeroGAdapter) {}

  async publishRunBundle(input: {
    environment: string;
    runId: string;
    bundle: string;
    contentType: string;
    bytes: Uint8Array | string;
    signalId?: string | null;
    intelId?: string | null;
    scope?: ZeroGNamespaceScope;
    segments?: string[];
    metadata?: Record<string, unknown>;
  }) {
    const key = this.namespaceBuilder.buildFileBundlePath({
      environment: input.environment,
      scope: input.scope ?? "proof",
      runId: input.runId,
      signalId: input.signalId ?? null,
      intelId: input.intelId ?? null,
      segments: input.segments ?? [],
      bundle: input.bundle,
    });
    const fileBytes: Uint8Array =
      typeof input.bytes === "string"
        ? Uint8Array.from(new TextEncoder().encode(input.bytes))
        : Uint8Array.from(input.bytes);
    const upload = await this.adapter.uploadFile({
      fileName: key,
      contentType: input.contentType,
      bytes: fileBytes as Uint8Array<ArrayBuffer>,
      metadata: {
        ...input.metadata,
        namespacePath: key,
      },
    });

    if (!upload.ok) {
      return upload;
    }

    return {
      ok: true as const,
      value: proofArtifactSchema.parse({
        id: `${key}:file`,
        runId: input.runId,
        signalId: input.signalId ?? null,
        intelId: input.intelId ?? null,
        refType: "file_artifact",
        key,
        locator: upload.value.locator,
        metadata: {
          ...upload.value.metadata,
          bundle: input.bundle,
          contentType: input.contentType,
          segments: input.segments ?? [],
          scope: input.scope ?? "proof",
          ...input.metadata,
        },
        compute: null,
        createdAt: new Date().toISOString(),
      }) satisfies ProofArtifact,
    };
  }
}
