import { createAnalystAgent, analystInputSchema, analystOutputSchema } from "@omen/agents";
import {
  assertAxlMcpMethodSupported,
  createAxlMcpErrorResponse,
  createAxlMcpSuccessResponse,
  defineAxlMcpServiceContract,
} from "@omen/axl";
import { axlMcpRequestSchema, type AxlMcpResponse } from "@omen/shared";

import { createServiceSwarmState } from "./service-runtime";

export const analystMcpContract = defineAxlMcpServiceContract({
  service: "analyst",
  version: "0.1.0",
  peerId: null,
  role: "analyst",
  description: "Deterministic thesis generation capability for researched candidates.",
  methods: ["thesis.generate"],
  tools: [
    {
      name: "thesis.generate",
      description: "Generate a structured thesis draft from a research bundle.",
      inputSchema: {
        input: "AnalystInput",
      },
    },
  ],
  tags: ["runtime", "mvp", "analyst"],
});

export class AnalystMcpService {
  private readonly agent = createAnalystAgent();

  readonly contract = analystMcpContract;

  async handle(request: unknown): Promise<AxlMcpResponse> {
    const parsed = axlMcpRequestSchema.parse(request);

    try {
      assertAxlMcpMethodSupported(this.contract, parsed);
      const input = analystInputSchema.parse(parsed.params.input ?? {});
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
          output: analystOutputSchema.parse(output),
        },
      });
    } catch (error) {
      return createAxlMcpErrorResponse({
        id: parsed.id,
        code: -32000,
        message:
          error instanceof Error ? error.message : "Analyst MCP request failed.",
      });
    }
  }
}
