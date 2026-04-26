import type { z } from "zod";

import { criticInputSchema, criticOutputSchema } from "../contracts/critic.js";
import type { RuntimeNodeDefinition } from "../framework/agent-runtime.js";
import type { SwarmState } from "../framework/state.js";
import { runCriticGate } from "../quality-gates/critic-gate.js";

export const reviewThesisWithCritic = (input: z.input<typeof criticInputSchema>) => {
  const parsed = criticInputSchema.parse(input);
  const gate = runCriticGate({
    thesis: parsed.evaluation.thesis,
    evidence: parsed.evaluation.evidence,
    config: {
      id: "runtime",
      mode: parsed.context.mode,
      marketUniverse: [],
      qualityThresholds: {
        minConfidence: 85,
        minRiskReward: 2,
        minConfluences: 2,
      },
      providers: {
        axl: { enabled: true, required: true },
        zeroGStorage: { enabled: true, required: true },
        zeroGCompute: { enabled: true, required: false },
        binance: { enabled: true, required: false },
        coinGecko: { enabled: true, required: false },
        defiLlama: { enabled: true, required: false },
        news: { enabled: true, required: false },
        twitterapi: { enabled: true, required: false },
      },
      paperTradingEnabled: true,
      testnetExecutionEnabled: false,
      mainnetExecutionEnabled: false,
      postToXEnabled: true,
      scanIntervalMinutes: 60,
      updatedAt: new Date().toISOString(),
    },
  });

  return criticOutputSchema.parse({
    review: {
      candidateId: parsed.evaluation.thesis.candidateId,
      decision: gate.decision,
      objections: gate.objections,
      forcedOutcomeReason: gate.forcedOutcomeReason,
    },
    blockingReasons: gate.blockingReasons,
  });
};

export const createCriticAgent = (): RuntimeNodeDefinition<
  z.input<typeof criticInputSchema>,
  z.input<typeof criticOutputSchema>
> => ({
  key: "critic-agent",
  role: "critic",
  inputSchema: criticInputSchema,
  outputSchema: criticOutputSchema,
  async invoke(input: z.input<typeof criticInputSchema>, state: SwarmState) {
    void state;
    return reviewThesisWithCritic(input);
  },
});
