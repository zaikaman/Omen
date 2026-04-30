import { createGeneratorAgent, generatorInputSchema, generatorOutputSchema } from "@omen/agents";
import {
  assertAxlMcpMethodSupported,
  createAxlMcpErrorResponse,
  createAxlMcpSuccessResponse,
  defineAxlMcpServiceContract,
} from "@omen/axl";
import { axlMcpRequestSchema, type AxlMcpResponse } from "@omen/shared";

import { createServiceSwarmState, isAxlOptionalLlmDisabled } from "./service-runtime.js";

export const generatorMcpContract = defineAxlMcpServiceContract({
  service: "generator",
  version: "0.1.0",
  peerId: null,
  role: "generator",
  description: "Publishable intel content generation capability.",
  methods: ["generator.compose", "generator.health"],
  tools: [
    {
      name: "generator.compose",
      description: "Generate publishable social and blog content from an intel report.",
      inputSchema: {
        input: "GeneratorInput",
      },
    },
  ],
  tags: ["runtime", "mvp", "generator"],
});

export class GeneratorMcpService {
  private readonly agent = createGeneratorAgent({
    llmClient: isAxlOptionalLlmDisabled("generator") ? null : undefined,
    shortenerClient: isAxlOptionalLlmDisabled("generator") ? null : undefined,
  });

  readonly contract = generatorMcpContract;

  async handle(request: unknown): Promise<AxlMcpResponse> {
    const parsed = axlMcpRequestSchema.parse(request);

    try {
      assertAxlMcpMethodSupported(this.contract, parsed);

      if (parsed.method === "generator.health") {
        return createAxlMcpSuccessResponse({
          id: parsed.id,
          result: {
            status: "ok",
            service: this.contract.service,
            method: parsed.method,
          },
        });
      }

      const input = generatorInputSchema.parse(parsed.params.input ?? {});
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
          output: generatorOutputSchema.parse(output),
        },
      });
    } catch (error) {
      return createAxlMcpErrorResponse({
        id: parsed.id,
        code: -32000,
        message: error instanceof Error ? error.message : "Generator MCP request failed.",
      });
    }
  }
}
