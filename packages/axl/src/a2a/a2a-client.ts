import {
  axlA2ADelegationEnvelopeSchema,
  err,
  ok,
  type AxlA2ADelegationEnvelope,
  type AxlA2ADelegationRequest,
  type Result,
} from "@omen/shared";

import {
  acceptDelegation,
  buildDelegationEnvelope,
  createDelegationRequest,
  resolveDelegation,
} from "./delegation-contract.js";
import type { AxlAdapter } from "../adapter/axl-adapter.js";

type A2ATransport = Pick<AxlAdapter, "callA2A">;
type JsonObject = Record<string, unknown>;

export class AxlA2AClient {
  constructor(private readonly transport: A2ATransport) {}

  async delegate(input: {
    peerId: string;
    request: AxlA2ADelegationRequest;
  }): Promise<Result<AxlA2ADelegationEnvelope, Error>> {
    const request = createDelegationRequest(input.request);
    const a2aRequest = this.createA2ASendMessageRequest(request);
    const response = await this.transport.callA2A({
      peerId: input.peerId,
      request: a2aRequest,
    });

    if (!response.ok) {
      return response;
    }

    return this.parseEnvelope(response.value, {
      peerId: input.peerId,
      request,
    });
  }

  parseEnvelope(
    value: Record<string, unknown>,
    context?: {
      peerId: string;
      request: AxlA2ADelegationRequest;
    },
  ): Result<AxlA2ADelegationEnvelope, Error> {
    try {
      const directEnvelope = axlA2ADelegationEnvelopeSchema.safeParse(value);
      if (directEnvelope.success) {
        return ok(directEnvelope.data);
      }

      if (!context) {
        return ok(axlA2ADelegationEnvelopeSchema.parse(value));
      }

      const jsonRpcError = asJsonObject(value.error);
      if (jsonRpcError) {
        return err(new Error(formatJsonRpcError(jsonRpcError)));
      }

      const mcpResponse = this.extractMcpResponse(value);
      if (!mcpResponse.ok) {
        return mcpResponse;
      }

      return ok(
        this.createEnvelopeFromMcpResponse({
          peerId: context.peerId,
          request: context.request,
          response: mcpResponse.value,
        }),
      );
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to parse AXL A2A delegation envelope."),
      );
    }
  }

  private createA2ASendMessageRequest(
    request: AxlA2ADelegationRequest,
  ): JsonObject {
    const mcpRequest = {
      jsonrpc: "2.0",
      id: request.delegationId,
      service: request.requestedRole,
      method: request.taskType,
      params: {
        input: request.payload,
      },
      context: {
        runId: request.runId,
        correlationId: request.correlationId,
        callerPeerId: request.fromPeerId,
        callerRole: request.fromRole,
      },
    };

    return {
      jsonrpc: "2.0",
      method: "SendMessage",
      id: `${request.delegationId}:send`,
      params: {
        message: {
          role: "ROLE_USER",
          parts: [
            {
              text: JSON.stringify({
                service: request.requestedRole,
                request: mcpRequest,
              }),
            },
          ],
          messageId: request.delegationId,
        },
      },
    };
  }

  private extractMcpResponse(
    value: JsonObject,
  ): Result<JsonObject, Error> {
    const result = asJsonObject(value.result);
    if (!result) {
      return err(new Error("AXL A2A response did not include a JSON-RPC result."));
    }

    const artifactText = findMcpArtifactText(result);
    if (!artifactText) {
      return err(new Error("AXL A2A response did not include an MCP response artifact."));
    }

    try {
      const parsed = JSON.parse(artifactText) as unknown;
      const response = asJsonObject(parsed);
      if (!response) {
        return err(new Error("AXL A2A MCP artifact was not a JSON object."));
      }

      return ok(response);
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to parse AXL A2A MCP response artifact."),
      );
    }
  }

  private createEnvelopeFromMcpResponse(input: {
    peerId: string;
    request: AxlA2ADelegationRequest;
    response: JsonObject;
  }): AxlA2ADelegationEnvelope {
    const receipt = acceptDelegation({
      request: input.request,
      assignedPeerId: input.request.toPeerId ?? input.peerId,
      assignedRole: input.request.requestedRole,
      acceptedAt: new Date().toISOString(),
    });
    const mcpError = asJsonObject(input.response.error);
    const mcpResult = asJsonObject(input.response.result);
    const output = asJsonObject(mcpResult?.output) ?? {};

    return buildDelegationEnvelope({
      request: input.request,
      receipt,
      result: resolveDelegation({
        request: input.request,
        responderPeerId: input.peerId,
        responderRole: input.request.requestedRole,
        state: mcpError ? "failed" : "completed",
        output,
        error: mcpError ? formatJsonRpcError(mcpError) : null,
        completedAt: new Date().toISOString(),
      }),
    });
  }
}

function asJsonObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function findMcpArtifactText(value: unknown): string | null {
  const object = asJsonObject(value);
  if (!object) {
    return null;
  }

  const taskText = findMcpArtifactText(object.task);
  if (taskText) {
    return taskText;
  }

  const artifacts = Array.isArray(object.artifacts) ? object.artifacts : [];
  for (const artifact of artifacts) {
    const artifactObject = asJsonObject(artifact);
    if (!artifactObject) {
      continue;
    }

    const parts = Array.isArray(artifactObject.parts) ? artifactObject.parts : [];
    const text = findTextPart(parts);
    if (text && (artifactObject.name === "mcp_response" || !artifactObject.name)) {
      return text;
    }
  }

  const directParts = Array.isArray(object.parts) ? object.parts : [];
  return findTextPart(directParts);
}

function findTextPart(parts: unknown[]): string | null {
  for (const part of parts) {
    const partObject = asJsonObject(part);
    if (typeof partObject?.text === "string") {
      return partObject.text;
    }
  }

  return null;
}

function formatJsonRpcError(error: JsonObject): string {
  const message =
    typeof error.message === "string" ? error.message : "AXL A2A JSON-RPC request failed.";
  const code = typeof error.code === "number" ? ` ${error.code}` : "";
  const data = typeof error.data === "string" ? `: ${error.data}` : "";
  return `AXL A2A error${code}: ${message}${data}`;
}
