import type { RuntimeConfig } from "@omen/shared";

import type { EvidenceItem, ThesisDraft } from "../framework/state.js";
import { evaluateThesisAgainstThresholds } from "./quality-gates.js";

export const runCriticGate = (input: {
  thesis: ThesisDraft;
  evidence: EvidenceItem[];
  config: RuntimeConfig;
}) => {
  const thresholdResult = evaluateThesisAgainstThresholds(input);

  if (thresholdResult.passed) {
    return {
      decision: "approved" as const,
      objections: thresholdResult.warnings,
      forcedOutcomeReason: null,
      blockingReasons: [] as string[],
    };
  }

  const watchlistEligible =
    input.thesis.direction === "WATCHLIST" ||
    thresholdResult.blockingReasons.every((reason) =>
      /risk\/reward|confluence/i.test(reason),
    );

  if (watchlistEligible) {
    return {
      decision: "watchlist_only" as const,
      objections: thresholdResult.warnings,
      forcedOutcomeReason:
        "Conviction was not strong enough for an actionable signal, but the setup can remain on watchlist.",
      blockingReasons: thresholdResult.blockingReasons,
    };
  }

  return {
    decision: "rejected" as const,
    objections: thresholdResult.warnings,
    forcedOutcomeReason:
      "The thesis failed the minimum quality gate and should not proceed to publication.",
    blockingReasons: thresholdResult.blockingReasons,
  };
};
