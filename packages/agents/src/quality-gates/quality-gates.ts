import type { RuntimeConfig } from "@omen/shared";

import type { EvidenceItem, ThesisDraft } from "../framework/state.js";

export type ThesisQualityGateResult = {
  passed: boolean;
  blockingReasons: string[];
  warnings: string[];
  repairable: boolean;
  repairInstructions: string[];
};

const actionableDirection = (direction: ThesisDraft["direction"]) =>
  direction === "LONG" || direction === "SHORT";

const relaxedRiskRewardFloor = 1.5;

export const evaluateThesisAgainstThresholds = (input: {
  thesis: ThesisDraft;
  evidence: EvidenceItem[];
  config: RuntimeConfig;
}): ThesisQualityGateResult => {
  const blockingReasons: string[] = [];
  const warnings: string[] = [];
  const repairInstructions: string[] = [];
  const terminalReasons: string[] = [];
  const actionable = actionableDirection(input.thesis.direction);

  if (input.thesis.confidence < input.config.qualityThresholds.minConfidence) {
    const reason = `Confidence ${input.thesis.confidence.toString()} is below the minimum threshold ${input.config.qualityThresholds.minConfidence.toString()}.`;
    blockingReasons.push(reason);
    terminalReasons.push(reason);
  }

  if (actionable && (input.thesis.riskReward ?? 0) < input.config.qualityThresholds.minRiskReward) {
    const riskReward = input.thesis.riskReward ?? 0;
    const reason = `Risk/reward ${riskReward.toFixed(2)} is below the preferred threshold ${input.config.qualityThresholds.minRiskReward.toFixed(2)}.`;

    if (riskReward >= relaxedRiskRewardFloor) {
      warnings.push(`${reason} Allowing because it remains above the relaxed execution floor ${relaxedRiskRewardFloor.toFixed(2)}.`);
    } else {
      blockingReasons.push(reason);
      terminalReasons.push(reason);
    }
  }

  if (actionable) {
    if (input.thesis.orderType === null) {
      blockingReasons.push("Actionable thesis is missing order type.");
      repairInstructions.push("Set orderType to market for immediate execution or limit for a pullback entry.");
    }

    if (input.thesis.tradingStyle === null) {
      blockingReasons.push("Actionable thesis is missing trading style.");
      repairInstructions.push("Set tradingStyle to day_trade or swing_trade based on the expected holding period.");
    }

    if (
      input.thesis.direction === "LONG" &&
      input.thesis.currentPrice !== null &&
      input.thesis.entryPrice !== null &&
      input.thesis.entryPrice > input.thesis.currentPrice
    ) {
      blockingReasons.push(
        "LONG entry is above current price, which would require a forbidden buy-stop order.",
      );
      repairInstructions.push("Move the LONG entry to current price for a market order or below current price for a limit order.");
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
      repairInstructions.push("Move the SHORT entry to current price for a market order or above current price for a limit order.");
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
        repairInstructions.push("For a market order, reset entryPrice to the current live price.");
      }
    }

    if (input.thesis.entryPrice === null || input.thesis.stopLoss === null) {
      blockingReasons.push("Actionable thesis is missing entry or stop-loss levels.");
      repairInstructions.push("Add executable entryPrice and stopLoss levels before approval.");
    } else {
      const stopDistance =
        input.thesis.direction === "LONG"
          ? (input.thesis.entryPrice - input.thesis.stopLoss) / input.thesis.entryPrice
          : (input.thesis.stopLoss - input.thesis.entryPrice) / input.thesis.entryPrice;

      if (stopDistance < 0.03) {
        blockingReasons.push("Stop-loss distance is below the required 3% minimum.");
        repairInstructions.push("Widen stopLoss to at least 3% from entry while preserving the minimum risk/reward.");
      }
    }
  }

  if (input.thesis.confluences.length < input.config.qualityThresholds.minConfluences) {
    const reason = `Confluence count ${input.thesis.confluences.length.toString()} is below the minimum threshold ${input.config.qualityThresholds.minConfluences.toString()}.`;
    const hasEnoughContext = actionable && input.evidence.length >= 2 && input.thesis.confluences.length > 0;

    if (hasEnoughContext) {
      warnings.push(`${reason} Allowing because prior agents supplied enough evidence context.`);
    } else {
      blockingReasons.push(reason);
      terminalReasons.push(reason);
    }
  }

  if (input.evidence.length === 0) {
    const reason = "No evidence items were attached to the thesis.";
    blockingReasons.push(reason);
    terminalReasons.push(reason);
  }

  if (input.thesis.direction === "WATCHLIST") {
    blockingReasons.push("WATCHLIST is disabled for live trade decisions; use NONE for no-trade.");
    terminalReasons.push("WATCHLIST is disabled for live trade decisions; use NONE for no-trade.");
  }

  if (input.thesis.direction === "NONE") {
    const reason = "Thesis direction resolved to NONE, so there is no actionable outcome to approve.";
    blockingReasons.push(reason);
    terminalReasons.push(reason);
  }

  return {
    passed: blockingReasons.length === 0,
    blockingReasons,
    warnings,
    repairable:
      actionable &&
      blockingReasons.length > 0 &&
      repairInstructions.length > 0 &&
      terminalReasons.length === 0,
    repairInstructions: Array.from(new Set(repairInstructions)),
  };
};
