import {
  chartVisionInputSchema,
  chartVisionOutputSchema,
  createChartVisionAgent,
} from "@omen/agents";
import {
  assertAxlMcpMethodSupported,
  createAxlMcpErrorResponse,
  createAxlMcpSuccessResponse,
  defineAxlMcpServiceContract,
} from "@omen/axl";
import { axlMcpRequestSchema, type AxlMcpResponse } from "@omen/shared";

import { createServiceSwarmState, isAxlOptionalLlmDisabled } from "./service-runtime.js";

export const chartVisionMcpContract = defineAxlMcpServiceContract({
  service: "chart_vision",
  version: "0.1.0",
  peerId: null,
  role: "chart_vision",
  description: "Chart vision capability for technical frame analysis and evidence.",
  methods: ["chart_vision.analyze", "chart_vision.health"],
  tools: [
    {
      name: "chart_vision.analyze",
      description: "Analyze chart frames for one researched candidate.",
      inputSchema: {
        input: "ChartVisionInput",
      },
    },
  ],
  tags: ["runtime", "mvp", "chart_vision"],
});

export class ChartVisionMcpService {
  private readonly agent = createChartVisionAgent({
    visionClient: isAxlOptionalLlmDisabled("chart_vision") ? null : undefined,
  });

  readonly contract = chartVisionMcpContract;

  async handle(request: unknown): Promise<AxlMcpResponse> {
    const parsed = axlMcpRequestSchema.parse(request);

    try {
      assertAxlMcpMethodSupported(this.contract, parsed);

      if (parsed.method === "chart_vision.health") {
        return createAxlMcpSuccessResponse({
          id: parsed.id,
          result: {
            status: "ok",
            service: this.contract.service,
            method: parsed.method,
          },
        });
      }

      const input = chartVisionInputSchema.parse(parsed.params.input ?? {});
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
          output: chartVisionOutputSchema.parse(output),
        },
      });
    } catch (error) {
      return createAxlMcpErrorResponse({
        id: parsed.id,
        code: -32000,
        message: error instanceof Error ? error.message : "Chart vision MCP request failed.",
      });
    }
  }
}
