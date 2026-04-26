import { createResearchAgent, researchInputSchema, researchOutputSchema } from "@omen/agents";
import {
  assertAxlMcpMethodSupported,
  createAxlMcpErrorResponse,
  createAxlMcpSuccessResponse,
  defineAxlMcpServiceContract,
} from "@omen/axl";
import { axlMcpRequestSchema, type AxlMcpResponse } from "@omen/shared";

import { createServiceSwarmState } from "./service-runtime";

export const researchMcpContract = defineAxlMcpServiceContract({
  service: "research",
  version: "0.1.0",
  peerId: null,
  role: "research",
  description: "Deterministic research bundle capability for catalysts and narrative context.",
  methods: ["research.bundle"],
  tools: [
    {
      name: "research.bundle",
      description: "Produce a normalized research bundle for one candidate.",
      inputSchema: {
        input: "ResearchInput",
      },
    },
  ],
  tags: ["runtime", "mvp", "research"],
});

export class ResearchMcpService {
  private readonly agent = createResearchAgent();

  readonly contract = researchMcpContract;

  async handle(request: unknown): Promise<AxlMcpResponse> {
    const parsed = axlMcpRequestSchema.parse(request);

    try {
      assertAxlMcpMethodSupported(this.contract, parsed);
      const input = researchInputSchema.parse(parsed.params.input ?? {});
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
          output: researchOutputSchema.parse(output),
        },
      });
    } catch (error) {
      return createAxlMcpErrorResponse({
        id: parsed.id,
        code: -32000,
        message:
          error instanceof Error ? error.message : "Research MCP request failed.",
      });
    }
  }
}
