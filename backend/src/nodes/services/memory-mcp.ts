import { createMemoryAgent, memoryInputSchema, memoryOutputSchema } from "@omen/agents";
import {
  assertAxlMcpMethodSupported,
  createAxlMcpErrorResponse,
  createAxlMcpSuccessResponse,
  defineAxlMcpServiceContract,
} from "@omen/axl";
import { axlMcpRequestSchema, type AxlMcpResponse } from "@omen/shared";

import { createServiceSwarmState } from "./service-runtime.js";

export const memoryMcpContract = defineAxlMcpServiceContract({
  service: "memory",
  version: "0.1.0",
  peerId: null,
  role: "memory",
  description: "Checkpoint memory capability for proof reference summaries.",
  methods: ["memory.checkpoint", "memory.health"],
  tools: [
    {
      name: "memory.checkpoint",
      description: "Build a checkpoint reference summary from recent notes and proof refs.",
      inputSchema: {
        input: "MemoryInput",
      },
    },
  ],
  tags: ["runtime", "mvp", "memory"],
});

export class MemoryMcpService {
  private readonly agent = createMemoryAgent();

  readonly contract = memoryMcpContract;

  async handle(request: unknown): Promise<AxlMcpResponse> {
    const parsed = axlMcpRequestSchema.parse(request);

    try {
      assertAxlMcpMethodSupported(this.contract, parsed);

      if (parsed.method === "memory.health") {
        return createAxlMcpSuccessResponse({
          id: parsed.id,
          result: {
            status: "ok",
            service: this.contract.service,
            method: parsed.method,
          },
        });
      }

      const input = memoryInputSchema.parse(parsed.params.input ?? {});
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
          output: memoryOutputSchema.parse(output),
        },
      });
    } catch (error) {
      return createAxlMcpErrorResponse({
        id: parsed.id,
        code: -32000,
        message: error instanceof Error ? error.message : "Memory MCP request failed.",
      });
    }
  }
}
