import { createScannerAgent, scannerInputSchema, scannerOutputSchema } from "@omen/agents";
import {
  assertAxlMcpMethodSupported,
  createAxlMcpErrorResponse,
  createAxlMcpSuccessResponse,
  defineAxlMcpServiceContract,
} from "@omen/axl";
import { axlMcpRequestSchema, type AxlMcpResponse } from "@omen/shared";

import { createServiceSwarmState } from "./service-runtime.js";

export const scannerMcpContract = defineAxlMcpServiceContract({
  service: "scanner",
  version: "0.1.0",
  peerId: null,
  role: "scanner",
  description: "Deterministic scanner capability for bias-aligned candidate selection.",
  methods: ["scan.run", "scan.health"],
  tools: [
    {
      name: "scan.run",
      description: "Run the scanner node against a provided universe and bias context.",
      inputSchema: {
        input: "ScannerInput",
      },
    },
  ],
  tags: ["runtime", "mvp", "scanner"],
});

export class ScannerMcpService {
  private readonly agent = createScannerAgent();

  readonly contract = scannerMcpContract;

  async handle(request: unknown): Promise<AxlMcpResponse> {
    const parsed = axlMcpRequestSchema.parse(request);

    try {
      assertAxlMcpMethodSupported(this.contract, parsed);

      if (parsed.method === "scan.health") {
        return createAxlMcpSuccessResponse({
          id: parsed.id,
          result: {
            status: "ok",
            service: this.contract.service,
            method: parsed.method,
          },
        });
      }

      const input = scannerInputSchema.parse(parsed.params.input ?? {});
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
          output: scannerOutputSchema.parse(output),
        },
      });
    } catch (error) {
      return createAxlMcpErrorResponse({
        id: parsed.id,
        code: -32000,
        message:
          error instanceof Error ? error.message : "Scanner MCP request failed.",
      });
    }
  }
}
