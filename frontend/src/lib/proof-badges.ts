import type { AxlRouteRecord } from './api/topology';
import type { ProofSummary } from './api/proofs';
import type { ProofBadgeState } from '../types/ui-models';

export type ProofBadgeIndex = {
  proofsByRunId: Map<string, ProofSummary>;
  axlRoutedRunIds: Set<string>;
};

export const buildProofBadgeIndex = (
  proofs: ProofSummary[],
  routes: AxlRouteRecord[],
): ProofBadgeIndex => ({
  proofsByRunId: new Map(proofs.map((proof) => [proof.runId, proof])),
  axlRoutedRunIds: new Set(
    routes
      .map((route) => route.runId)
      .filter((runId): runId is string => Boolean(runId)),
  ),
});

export const getProofBadgesForRun = (
  runId: string | null | undefined,
  index: ProofBadgeIndex,
): ProofBadgeState | undefined => {
  if (!runId) {
    return undefined;
  }

  const proof = index.proofsByRunId.get(runId);

  return {
    runId,
    hasManifest: Boolean(proof?.manifestRefId),
    hasComputeHash: (proof?.computeCount ?? 0) > 0,
    hasAxlRoute: index.axlRoutedRunIds.has(runId),
    hasPostProof: Boolean(proof?.postUrl),
    postProofUrl: proof?.postUrl ?? null,
  };
};
