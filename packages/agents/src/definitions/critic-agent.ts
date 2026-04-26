import type { z } from "zod";
import { z as zod } from "zod";

import { criticInputSchema, criticOutputSchema } from "../contracts/critic.js";
import type { RuntimeNodeDefinition } from "../framework/agent-runtime.js";
import type { SwarmState } from "../framework/state.js";
import { OpenAiCompatibleJsonClient } from "../llm/openai-compatible-client.js";
import { resolveModelProfileForRole } from "../llm/model-routing.js";
import { buildCriticSystemPrompt } from "../prompts/critic/system.js";
import { runCriticGate } from "../quality-gates/critic-gate.js";

const criticAgentOptionsSchema = zod.object({
  llmClient: zod.custom<OpenAiCompatibleJsonClient>().nullable().optional(),
});

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

const decisionRank: Record<
  z.infer<typeof criticOutputSchema>["review"]["decision"],
  number
> = {
  approved: 0,
  watchlist_only: 1,
  rejected: 2,
};

export class CriticAgentFactory {
  private readonly llmClient: OpenAiCompatibleJsonClient | null;

  constructor(input: zod.input<typeof criticAgentOptionsSchema> = {}) {
    const parsed = criticAgentOptionsSchema.parse(input);
    this.llmClient =
      parsed.llmClient ??
      OpenAiCompatibleJsonClient.fromEnv(resolveModelProfileForRole("critic"));
  }

  createDefinition(): RuntimeNodeDefinition<
    z.input<typeof criticInputSchema>,
    z.input<typeof criticOutputSchema>
  > {
    return {
      key: "critic-agent",
      role: "critic",
      inputSchema: criticInputSchema,
      outputSchema: criticOutputSchema,
      invoke: async (input, state) => this.review(input, state),
    };
  }

  private async review(
    input: z.input<typeof criticInputSchema>,
    state: SwarmState,
  ) {
    void state;
    const gateReview = reviewThesisWithCritic(input);

    if (this.llmClient === null) {
      return gateReview;
    }

    const parsed = criticInputSchema.parse(input);

    try {
      const llmReview = await this.llmClient.completeJson({
        schema: criticOutputSchema,
        systemPrompt: buildCriticSystemPrompt({
          symbol: parsed.evaluation.thesis.asset,
          evidenceCount: parsed.evaluation.evidence.length,
          confidence: parsed.evaluation.thesis.confidence,
        }),
        userPrompt: JSON.stringify(
          {
            thesis: parsed.evaluation.thesis,
            evidence: parsed.evaluation.evidence,
            instruction:
              "Be conservative. Use approved only when evidence and risk/reward are both strong. Return concise blockingReasons when downgrading.",
          },
          null,
          2,
        ),
      });
      const stricterReview =
        decisionRank[llmReview.review.decision] >= decisionRank[gateReview.review.decision]
          ? llmReview.review
          : gateReview.review;

      return criticOutputSchema.parse({
        review: {
          ...stricterReview,
          candidateId: parsed.evaluation.thesis.candidateId,
          objections: Array.from(
            new Set([
              ...(gateReview.review.objections ?? []),
              ...(llmReview.review.objections ?? []),
            ]),
          ),
          forcedOutcomeReason:
            stricterReview.decision === gateReview.review.decision
              ? gateReview.review.forcedOutcomeReason
              : llmReview.review.forcedOutcomeReason ?? gateReview.review.forcedOutcomeReason,
        },
        blockingReasons: Array.from(
          new Set([...(gateReview.blockingReasons ?? []), ...(llmReview.blockingReasons ?? [])]),
        ),
      });
    } catch {
      return gateReview;
    }
  }
}

export const createCriticAgent = (
  input: zod.input<typeof criticAgentOptionsSchema> = {},
) => new CriticAgentFactory(input).createDefinition();
