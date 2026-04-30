import {
  createMarketBiasAgent,
  marketBiasAgentInputSchema,
  marketBiasAgentOutputSchema,
} from "@omen/agents";
import {
  assertAxlMcpMethodSupported,
  createAxlMcpErrorResponse,
  createAxlMcpSuccessResponse,
  defineAxlMcpServiceContract,
} from "@omen/axl";
import { axlMcpRequestSchema, type AxlMcpResponse } from "@omen/shared";

import { createServiceSwarmState } from "./service-runtime.js";

export const marketBiasMcpContract = defineAxlMcpServiceContract({
  service: "market_bias",
  version: "0.1.0",
  peerId: null,
  role: "market_bias",
  description: "Market regime and directional bias derivation capability.",
  methods: ["market_bias.derive", "market_bias.health"],
  tools: [
    {
      name: "market_bias.derive",
      description: "Derive the current market bias from snapshots and narratives.",
      inputSchema: {
        input: "MarketBiasAgentInput",
      },
    },
  ],
  tags: ["runtime", "mvp", "market_bias"],
});

export class MarketBiasMcpService {
  private readonly agent = createMarketBiasAgent();

  readonly contract = marketBiasMcpContract;

  async handle(request: unknown): Promise<AxlMcpResponse> {
    const parsed = axlMcpRequestSchema.parse(request);

    try {
      assertAxlMcpMethodSupported(this.contract, parsed);

      if (parsed.method === "market_bias.health") {
        return createAxlMcpSuccessResponse({
          id: parsed.id,
          result: {
            status: "ok",
            service: this.contract.service,
            method: parsed.method,
          },
        });
      }

      const input = marketBiasAgentInputSchema.parse(parsed.params.input ?? {});
      const output = await this.agent.invoke(
        input,
        createServiceSwarmState({
          runId: input.context.runId,
          mode: input.context.mode,
        }),
      );

      return createAxlMcpSuccessResponse({
        id: parsed.id,
        result: {
          output: marketBiasAgentOutputSchema.parse(output),
        },
      });
    } catch (error) {
      return createAxlMcpErrorResponse({
        id: parsed.id,
        code: -32000,
        message: error instanceof Error ? error.message : "Market bias MCP request failed.",
      });
    }
  }
}
