import {
  proofArtifactSchema,
  proofFinalizationSchema,
  runProofBundleSchema,
  runSchema,
  zeroGRunManifestSchema,
  type ProofFinalization,
  type ProofArtifact,
  type Run,
  type RunProofBundle,
  type ZeroGRunManifest,
} from '@omen/shared';

import { apiRequest } from './client';

export type ProofSummary = {
  runId: string;
  manifestRefId: string | null;
  finalSignalId: string | null;
  finalIntelId: string | null;
  artifactCount: number;
  storageCount: number;
  computeCount: number;
  chainCount: number;
  postCount: number;
  proofFinalization: ProofFinalization;
  createdAt: string;
};

export type ProofFeedResponse = {
  items: ProofSummary[];
  nextCursor: string | null;
};

export type ProofDetailResponse = {
  run: Run;
  proofBundle: RunProofBundle;
  artifacts: ProofArtifact[];
  manifest: ZeroGRunManifest | null;
  proofFinalization: ProofFinalization;
};

const fallbackProofFinalization = (input: {
  artifactCount: number;
  manifestRefId?: string | null;
  createdAt?: string | null;
}) =>
  proofFinalizationSchema.parse({
    status: input.manifestRefId ? 'complete' : 'partial',
    artifactCount: input.artifactCount,
    manifestRefId: input.manifestRefId ?? null,
    chainRefId: null,
    startedAt: null,
    completedAt: input.createdAt ?? null,
    error: input.manifestRefId
      ? null
      : 'Run proof manifest has not been recorded yet.',
  });

const proofSummarySchema = {
  parse: (input: unknown): ProofSummary => {
    const value = input as ProofSummary;

    if (!value || typeof value.runId !== 'string') {
      throw new Error('Invalid proof summary response.');
    }

    return {
      runId: value.runId,
      manifestRefId:
        typeof value.manifestRefId === 'string' ? value.manifestRefId : null,
      finalSignalId:
        typeof value.finalSignalId === 'string' ? value.finalSignalId : null,
      finalIntelId:
        typeof value.finalIntelId === 'string' ? value.finalIntelId : null,
      artifactCount:
        typeof value.artifactCount === 'number' ? value.artifactCount : 0,
      storageCount:
        typeof value.storageCount === 'number' ? value.storageCount : 0,
      computeCount:
        typeof value.computeCount === 'number' ? value.computeCount : 0,
      chainCount:
        typeof value.chainCount === 'number' ? value.chainCount : 0,
      postCount:
        typeof value.postCount === 'number' ? value.postCount : 0,
      proofFinalization: proofFinalizationSchema.parse(
        value.proofFinalization ??
          fallbackProofFinalization({
            artifactCount:
              typeof value.artifactCount === 'number' ? value.artifactCount : 0,
            manifestRefId:
              typeof value.manifestRefId === 'string' ? value.manifestRefId : null,
            createdAt: value.createdAt,
          }),
      ),
      createdAt: value.createdAt,
    };
  },
};

const proofFeedResponseSchema = {
  parse: (input: unknown): ProofFeedResponse => {
    const payload = input as { items?: unknown[]; nextCursor?: unknown };

    return {
      items: (payload.items ?? []).map((item) => proofSummarySchema.parse(item)),
      nextCursor:
        typeof payload.nextCursor === 'string' ? payload.nextCursor : null,
    };
  },
};

const proofDetailResponseSchema = {
  parse: (input: unknown): ProofDetailResponse => {
    const payload = input as {
      run?: unknown;
      proofBundle?: unknown;
      artifacts?: unknown;
      manifest?: unknown;
      proofFinalization?: unknown;
    };
    const artifacts = Array.isArray(payload.artifacts)
      ? payload.artifacts.map((artifact) => proofArtifactSchema.parse(artifact))
      : [];
    const manifest =
      payload.manifest === null || payload.manifest === undefined
        ? null
        : zeroGRunManifestSchema.parse(payload.manifest);

    return {
      run: runSchema.parse(payload.run),
      proofBundle: runProofBundleSchema.parse(payload.proofBundle),
      artifacts,
      manifest,
      proofFinalization: proofFinalizationSchema.parse(
        payload.proofFinalization ??
          fallbackProofFinalization({
            artifactCount: artifacts.length,
            manifestRefId: manifest?.manifestArtifact?.artifact.id ?? null,
            createdAt: manifest?.createdAt ?? null,
          }),
      ),
    };
  },
};

export const getLiveProofFeed = (limit = 20): Promise<ProofFeedResponse> =>
  apiRequest(`/proofs?limit=${limit.toString()}`, proofFeedResponseSchema);

export const getProofFeed = (limit = 20): Promise<ProofFeedResponse> =>
  getLiveProofFeed(limit);

export const getLiveProofDetail = (
  runId: string,
): Promise<ProofDetailResponse> =>
  apiRequest(`/proofs/${encodeURIComponent(runId)}`, proofDetailResponseSchema);

export const getProofDetail = (runId: string): Promise<ProofDetailResponse> =>
  getLiveProofDetail(runId);
