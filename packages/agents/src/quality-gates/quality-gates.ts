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

  if (actionable && (input.thesis.riskReward ?? 0) < input.config.qualityThresholds.minRiskReward) {
    blockingReasons.push(
      `Risk/reward ${(input.thesis.riskReward ?? 0).toFixed(2)} is below the minimum threshold ${input.config.qualityThresholds.minRiskReward.toFixed(2)}.`,
    );
  }

  if (actionable) {
    if (
      input.thesis.direction === "LONG" &&
      input.thesis.currentPrice !== null &&
      input.thesis.entryPrice !== null &&
      input.thesis.entryPrice > input.thesis.currentPrice
    ) {
      blockingReasons.push(
        "LONG entry is above current price, which would require a forbidden buy-stop order.",
      );
    }

    if (
      input.thesis.direction === "SHORT" &&
      input.thesis.currentPrice !== null &&
      input.thesis.entryPrice !== null &&
      input.thesis.entryPrice < input.thesis.currentPrice
    ) {
      blockingReasons.push(
        "SHORT entry is below current price, which would require a forbidden sell-stop order.",
      );
    }

    if (
      input.thesis.orderType === "market" &&
      input.thesis.currentPrice !== null &&
      input.thesis.entryPrice !== null
    ) {
      const priceDeviation = Math.abs(
        (input.thesis.entryPrice - input.thesis.currentPrice) / input.thesis.currentPrice,
      );

      if (priceDeviation > 0.01) {
        blockingReasons.push(
          "Market order entry is more than 1% away from current price.",
        );
      }
    }

    if (input.thesis.entryPrice === null || input.thesis.stopLoss === null) {
      blockingReasons.push("Actionable thesis is missing entry or stop-loss levels.");
    } else {
      const stopDistance =
        input.thesis.direction === "LONG"
          ? (input.thesis.entryPrice - input.thesis.stopLoss) / input.thesis.entryPrice
          : (input.thesis.stopLoss - input.thesis.entryPrice) / input.thesis.entryPrice;

      if (stopDistance < 0.03) {
        blockingReasons.push("Stop-loss distance is below the required 3% minimum.");
      }
    }
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
    warnings.push(
      "Thesis remained in watchlist mode and should not be promoted to a trade signal.",
    );
  }

  if (input.thesis.direction === "NONE") {
    blockingReasons.push(
      "Thesis direction resolved to NONE, so there is no actionable outcome to approve.",
    );
  }

  if (/no additional missing-data flags/i.test(input.thesis.missingDataNotes)) {
    warnings.push(
      "Missing-data notes are minimal; reviewer should confirm that data coverage is truly complete.",
    );
  }

  return {
    passed: blockingReasons.length === 0,
    blockingReasons,
    warnings,
  };
};
