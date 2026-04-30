import { createPublisherAgent, publisherInputSchema, publisherOutputSchema } from "@omen/agents";
import {
  assertAxlMcpMethodSupported,
  createAxlMcpErrorResponse,
  createAxlMcpSuccessResponse,
  defineAxlMcpServiceContract,
} from "@omen/axl";
import { axlMcpRequestSchema, type AxlMcpResponse } from "@omen/shared";

import { createServiceSwarmState } from "./service-runtime.js";

export const publisherMcpContract = defineAxlMcpServiceContract({
  service: "publisher",
  version: "0.1.0",
  peerId: null,
  role: "publisher",
  description: "Publisher decision and draft preparation capability.",
  methods: ["publisher.publish", "publisher.health"],
  tools: [
    {
      name: "publisher.publish",
      description: "Prepare publication outcome and outbound draft packet.",
      inputSchema: {
        input: "PublisherInput",
      },
    },
  ],
  tags: ["runtime", "mvp", "publisher"],
});

export class PublisherMcpService {
  private readonly agent = createPublisherAgent();

  readonly contract = publisherMcpContract;

  async handle(request: unknown): Promise<AxlMcpResponse> {
    const parsed = axlMcpRequestSchema.parse(request);

    try {
      assertAxlMcpMethodSupported(this.contract, parsed);

      if (parsed.method === "publisher.health") {
        return createAxlMcpSuccessResponse({
          id: parsed.id,
          result: {
            status: "ok",
            service: this.contract.service,
            method: parsed.method,
          },
        });
      }

      const input = publisherInputSchema.parse(parsed.params.input ?? {});
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
          output: publisherOutputSchema.parse(output),
        },
      });
    } catch (error) {
      return createAxlMcpErrorResponse({
        id: parsed.id,
        code: -32000,
        message: error instanceof Error ? error.message : "Publisher MCP request failed.",
      });
    }
  }
}
