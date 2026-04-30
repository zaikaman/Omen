import {
  createMemoryAgent,
  memoryInputSchema,
  memoryOutputSchema,
  memoryRecallInputSchema,
  memoryRecallOutputSchema,
} from "@omen/agents";
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
  methods: ["memory.checkpoint", "memory.recall", "memory.health"],
  tools: [
    {
      name: "memory.checkpoint",
      description: "Build a checkpoint reference summary from recent notes and proof refs.",
      inputSchema: {
        input: "MemoryInput",
      },
    },
    {
      name: "memory.recall",
      description: "Return prior run context relevant to another agent's current task.",
      inputSchema: {
        input: "MemoryRecallInput",
      },
    },
  ],
  tags: ["runtime", "mvp", "memory", "peer-context"],
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

      if (parsed.method === "memory.recall") {
        const input = memoryRecallInputSchema.parse(parsed.params.input ?? {});
        const relevantNotes = input.recentNotes.slice(-6);
        const reportHint = input.report
          ? `${input.report.title}: ${input.report.summary}`
          : "No report context was provided.";
        const summary = [
          `Memory recall for ${input.query}.`,
          reportHint,
          relevantNotes.length > 0
            ? `Recent swarm notes: ${relevantNotes.join(" | ")}`
            : "No recent swarm notes were provided.",
        ].join(" ");

        return createAxlMcpSuccessResponse({
          id: parsed.id,
          result: {
            output: memoryRecallOutputSchema.parse({
              summary,
              relevantNotes,
              proofRefIds: relevantNotes
                .map((note) => note.match(/proof-ref:([^\s|]+)/)?.[1])
                .filter((value): value is string => Boolean(value)),
            }),
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
