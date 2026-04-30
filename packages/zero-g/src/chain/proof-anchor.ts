import {
  chainProofSchema,
  proofArtifactSchema,
  type ChainProof,
  type ProofArtifact,
} from "@omen/shared";
import { err, ok, type Result } from "@omen/shared";

import { ZeroGChainAdapter, type ZeroGChainConfig } from "./chain-adapter.js";

export class ZeroGProofAnchor {
  private readonly adapter: ZeroGChainAdapter | null;

  constructor(config?: ZeroGChainConfig | null) {
    this.adapter = config ? new ZeroGChainAdapter(config) : null;
  }

  async anchorManifest(input: {
    runId: string;
    signalId?: string | null;
    intelId?: string | null;
    manifestRoot: string;
    locator?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<Result<{ chainProof: ChainProof; artifact: ProofArtifact } | null, Error>> {
    if (!this.adapter) {
      return ok(null);
    }

    const anchored = await this.adapter.createProofAnchor({
      runId: input.runId,
      manifestRoot: input.manifestRoot,
      manifestUri: input.locator?.trim() ? input.locator : input.manifestRoot,
    });

    if (!anchored.ok) {
      return anchored;
    }

    const chainProof = chainProofSchema.parse(anchored.value);

    return ok({
      chainProof,
      artifact: proofArtifactSchema.parse({
        id: `${input.runId}:chain-anchor`,
        runId: input.runId,
        signalId: input.signalId ?? null,
        intelId: input.intelId ?? null,
        refType: "chain_proof",
        key: input.manifestRoot,
        locator:
          input.locator ??
          chainProof.explorerUrl ??
          `chain://${chainProof.chainId}/${encodeURIComponent(chainProof.manifestRoot)}`,
        metadata: {
          chainProof,
          ...(input.metadata ?? {}),
        },
        compute: null,
        createdAt: chainProof.anchoredAt ?? new Date().toISOString(),
      }),
    });
  }

  requireConfiguredAdapter() {
    if (!this.adapter) {
      return err(new Error("0G chain proof anchor is not configured."));
    }

    return ok(this.adapter);
  }
}
