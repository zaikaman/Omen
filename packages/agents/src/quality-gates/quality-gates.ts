import type { RuntimeConfig } from "@omen/shared";

import type { EvidenceItem, ThesisDraft } from "../framework/state.js";

export type ThesisQualityGateResult = {
  passed: boolean;
  blockingReasons: string[];
  warnings: string[];
};

const actionableDirection = (direction: ThesisDraft["direction"]) =>
  direction === "LONG" || direction === "SHORT";

export const evaluateThesisAgainstThresholds = (input: {
  thesis: ThesisDraft;
  evidence: EvidenceItem[];
  config: RuntimeConfig;
}): ThesisQualityGateResult => {
  const blockingReasons: string[] = [];
  const warnings: string[] = [];
  const actionable = actionableDirection(input.thesis.direction);

  if (input.thesis.confidence < input.config.qualityThresholds.minConfidence) {
    blockingReasons.push(
      `Confidence ${input.thesis.confidence.toString()} is below the minimum threshold ${input.config.qualityThresholds.minConfidence.toString()}.`,
    );
  }

  if (
    actionable &&
    (input.thesis.riskReward ?? 0) < input.config.qualityThresholds.minRiskReward
  ) {
    blockingReasons.push(
      `Risk/reward ${(input.thesis.riskReward ?? 0).toFixed(2)} is below the minimum threshold ${input.config.qualityThresholds.minRiskReward.toFixed(2)}.`,
    );
  }

  if (input.thesis.confluences.length < input.config.qualityThresholds.minConfluences) {
    blockingReasons.push(
      `Confluence count ${input.thesis.confluences.length.toString()} is below the minimum threshold ${input.config.qualityThresholds.minConfluences.toString()}.`,
    );
  }

  if (input.evidence.length === 0) {
    blockingReasons.push("No evidence items were attached to the thesis.");
  }

  if (input.thesis.direction === "WATCHLIST") {
    warnings.push("Thesis remained in watchlist mode and should not be promoted to a trade signal.");
  }

  if (input.thesis.direction === "NONE") {
    blockingReasons.push("Thesis direction resolved to NONE, so there is no actionable outcome to approve.");
  }

  if (/no additional missing-data flags/i.test(input.thesis.missingDataNotes)) {
    warnings.push("Missing-data notes are minimal; reviewer should confirm that data coverage is truly complete.");
  }

  return {
    passed: blockingReasons.length === 0,
    blockingReasons,
    warnings,
  };
};
