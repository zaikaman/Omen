import { createWriterAgent, writerInputSchema, writerOutputSchema } from "@omen/agents";
import {
  assertAxlMcpMethodSupported,
  createAxlMcpErrorResponse,
  createAxlMcpSuccessResponse,
  defineAxlMcpServiceContract,
} from "@omen/axl";
import { axlMcpRequestSchema, type AxlMcpResponse } from "@omen/shared";

import { createServiceSwarmState, isAxlOptionalLlmDisabled } from "./service-runtime.js";

export const writerMcpContract = defineAxlMcpServiceContract({
  service: "writer",
  version: "0.1.0",
  peerId: null,
  role: "writer",
  description: "Long-form intel article drafting capability.",
  methods: ["writer.article", "writer.health"],
  tools: [
    {
      name: "writer.article",
      description: "Draft a long-form article from an intel report and generated content.",
      inputSchema: {
        input: "WriterInput",
      },
    },
  ],
  tags: ["runtime", "mvp", "writer"],
});

export class WriterMcpService {
  private readonly agent = createWriterAgent({
    llmClient: isAxlOptionalLlmDisabled("writer") ? null : undefined,
  });

  readonly contract = writerMcpContract;

  async handle(request: unknown): Promise<AxlMcpResponse> {
    const parsed = axlMcpRequestSchema.parse(request);

    try {
      assertAxlMcpMethodSupported(this.contract, parsed);

      if (parsed.method === "writer.health") {
        return createAxlMcpSuccessResponse({
          id: parsed.id,
          result: {
            status: "ok",
            service: this.contract.service,
            method: parsed.method,
          },
        });
      }

      const input = writerInputSchema.parse(parsed.params.input ?? {});
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
          output: writerOutputSchema.parse(output),
        },
      });
    } catch (error) {
      return createAxlMcpErrorResponse({
        id: parsed.id,
        code: -32000,
        message: error instanceof Error ? error.message : "Writer MCP request failed.",
      });
    }
  }
}
