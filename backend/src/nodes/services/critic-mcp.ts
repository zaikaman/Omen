import { createCriticAgent, criticInputSchema, criticOutputSchema } from "@omen/agents";
import {
  assertAxlMcpMethodSupported,
  createAxlMcpErrorResponse,
  createAxlMcpSuccessResponse,
  defineAxlMcpServiceContract,
} from "@omen/axl";
import { axlMcpRequestSchema, type AxlMcpResponse } from "@omen/shared";

import { createServiceSwarmState } from "./service-runtime";

export const criticMcpContract = defineAxlMcpServiceContract({
  service: "critic",
  version: "0.1.0",
  peerId: null,
  role: "critic",
  description: "Deterministic quality-gate and review capability for thesis evaluation.",
  methods: ["critic.review", "critic.health"],
  tools: [
    {
      name: "critic.review",
      description: "Review a thesis draft and return critic objections or approval state.",
      inputSchema: {
        input: "CriticInput",
      },
    },
  ],
  tags: ["runtime", "mvp", "critic"],
});

export class CriticMcpService {
  private readonly agent = createCriticAgent();

  readonly contract = criticMcpContract;

  async handle(request: unknown): Promise<AxlMcpResponse> {
    const parsed = axlMcpRequestSchema.parse(request);

    try {
      assertAxlMcpMethodSupported(this.contract, parsed);

      if (parsed.method === "critic.health") {
        return createAxlMcpSuccessResponse({
          id: parsed.id,
          result: {
            status: "ok",
            service: this.contract.service,
            method: parsed.method,
          },
        });
      }

      const input = criticInputSchema.parse(parsed.params.input ?? {});
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
          output: criticOutputSchema.parse(output),
        },
      });
    } catch (error) {
      return createAxlMcpErrorResponse({
        id: parsed.id,
        code: -32000,
        message:
          error instanceof Error ? error.message : "Critic MCP request failed.",
      });
    }
  }
}
