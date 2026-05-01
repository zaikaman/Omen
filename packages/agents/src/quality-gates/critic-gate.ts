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
      repairable: false,
      repairInstructions: [] as string[],
    };
  }

  if (thresholdResult.repairable) {
    return {
      decision: "rejected" as const,
      objections: thresholdResult.warnings,
      forcedOutcomeReason:
        "The trade idea has fixable execution issues and should receive one analyst repair attempt.",
      blockingReasons: thresholdResult.blockingReasons,
      repairable: true,
      repairInstructions: thresholdResult.repairInstructions,
    };
  }

  return {
    decision: "rejected" as const,
    objections: thresholdResult.warnings,
    forcedOutcomeReason:
      "The thesis failed the minimum quality gate and should not proceed to publication.",
    blockingReasons: thresholdResult.blockingReasons,
    repairable: false,
    repairInstructions: [] as string[],
  };
};
