import { createIntelAgent, intelInputSchema, intelOutputSchema } from "@omen/agents";
import {
  assertAxlMcpMethodSupported,
  createAxlMcpErrorResponse,
  createAxlMcpSuccessResponse,
  defineAxlMcpServiceContract,
} from "@omen/axl";
import { axlMcpRequestSchema, type AxlMcpResponse } from "@omen/shared";

import { createServiceSwarmState } from "./service-runtime.js";

export const intelMcpContract = defineAxlMcpServiceContract({
  service: "intel",
  version: "0.1.0",
  peerId: null,
  role: "intel",
  description: "Market intelligence report synthesis capability.",
  methods: ["intel.summarize", "intel.health"],
  tools: [
    {
      name: "intel.summarize",
      description: "Generate or skip a market intelligence report from current swarm context.",
      inputSchema: {
        input: "IntelInput",
      },
    },
  ],
  tags: ["runtime", "mvp", "intel"],
});

export class IntelMcpService {
  private readonly agent = createIntelAgent();

  readonly contract = intelMcpContract;

  async handle(request: unknown): Promise<AxlMcpResponse> {
    const parsed = axlMcpRequestSchema.parse(request);

    try {
      assertAxlMcpMethodSupported(this.contract, parsed);

      if (parsed.method === "intel.health") {
        return createAxlMcpSuccessResponse({
          id: parsed.id,
          result: {
            status: "ok",
            service: this.contract.service,
            method: parsed.method,
          },
        });
      }

      const input = intelInputSchema.parse(parsed.params.input ?? {});
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
          output: intelOutputSchema.parse(output),
        },
      });
    } catch (error) {
      return createAxlMcpErrorResponse({
        id: parsed.id,
        code: -32000,
        message: error instanceof Error ? error.message : "Intel MCP request failed.",
      });
    }
  }
}
