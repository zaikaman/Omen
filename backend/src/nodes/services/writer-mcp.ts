import {
  createWriterAgent,
  memoryRecallOutputSchema,
  writerInputSchema,
  writerOutputSchema,
} from "@omen/agents";
import {
  assertAxlMcpMethodSupported,
  createAxlMcpErrorResponse,
  createAxlMcpSuccessResponse,
  defineAxlMcpServiceContract,
} from "@omen/axl";
import { axlMcpRequestSchema, type AxlMcpResponse } from "@omen/shared";

import {
  createServiceAxlMcpAdapter,
  createServiceSwarmState,
  resolveAxlPeerIdForService,
} from "./service-runtime.js";

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
  tags: ["runtime", "mvp", "writer", "peer-memory-client"],
});

export class WriterMcpService {
  private readonly agent = createWriterAgent();

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
      const memoryPeerId = resolveAxlPeerIdForService("memory");
      const memoryRequest = {
        jsonrpc: "2.0",
        id: `${parsed.id}:memory-recall`,
        service: "memory",
        method: "memory.recall",
        params: {
          input: {
            context: input.context,
            query: "writer.article prior context",
            report: input.report,
            recentNotes: [
              ...input.evidence.map((item) => item.summary),
              ...(input.generatedContent?.logMessage ? [input.generatedContent.logMessage] : []),
            ].slice(-8),
          },
        },
        context: {
          runId: input.context.runId,
          correlationId: `${input.context.runId}:writer-memory-recall`,
          callerPeerId:
            typeof parsed.context.callerPeerId === "string" ? parsed.context.callerPeerId : null,
          callerRole: "writer",
        },
      };
      const memoryResponse = await createServiceAxlMcpAdapter().callMcp({
        peerId: memoryPeerId,
        service: "memory",
        request: memoryRequest,
      });

      if (!memoryResponse.ok) {
        throw memoryResponse.error;
      }

      const memoryError = memoryResponse.value.error as
        | { message?: unknown; code?: unknown }
        | undefined;
      if (memoryError) {
        const message =
          typeof memoryError.message === "string"
            ? memoryError.message
            : "Memory recall returned an AXL MCP error.";
        throw new Error(message);
      }

      const memoryResult = memoryRecallOutputSchema.parse(
        (memoryResponse.value.result as Record<string, unknown> | undefined)?.output,
      );
      const enrichedInput = writerInputSchema.parse({
        ...input,
        evidence: [
          ...input.evidence,
          {
            category: "fundamental",
            summary: memoryResult.summary,
            sourceLabel: "AXL peer memory recall",
            sourceUrl: null,
            structuredData: {
              sourcePeerId: memoryPeerId,
              service: "memory",
              method: "memory.recall",
              relevantNotes: memoryResult.relevantNotes,
              proofRefIds: memoryResult.proofRefIds,
            },
          },
        ],
      });
      const output = await this.agent.invoke(
        enrichedInput,
        createServiceSwarmState({
          runId: enrichedInput.context.runId,
          mode: enrichedInput.context.mode,
        }),
      );

      return createAxlMcpSuccessResponse({
        id: parsed.id,
        result: {
          output: writerOutputSchema.parse({
            ...output,
            peerContext: {
              sourcePeerId: memoryPeerId,
              service: "memory",
              method: "memory.recall",
              summary: memoryResult.summary,
            },
          }),
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
