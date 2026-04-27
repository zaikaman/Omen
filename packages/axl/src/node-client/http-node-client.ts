import { err, ok, type Result } from "@omen/shared";
import { z } from "zod";

import {
  axlTopologyResponseSchema,
  type AxlTopologyResponse,
} from "../peer-status/peer-status.js";

const httpMethodSchema = z.enum(["GET", "POST"]);
const axlHttpBodySchema = z.custom<string | Uint8Array>(
  (value) => typeof value === "string" || value instanceof Uint8Array,
  "Expected a string or Uint8Array request body.",
);

export const axlNodeHttpClientConfigSchema = z.object({
  baseUrl: z.string().url(),
  requestTimeoutMs: z.number().int().min(1).default(10_000),
  defaultHeaders: z.record(z.string(), z.string()).default({}),
});

export const axlHttpRequestSchema = z.object({
  path: z.string().min(1),
  method: httpMethodSchema,
  headers: z.record(z.string(), z.string()).optional(),
  body: axlHttpBodySchema.optional(),
  contentType: z.string().min(1).optional(),
});

export type AxlNodeHttpClientConfig = z.infer<typeof axlNodeHttpClientConfigSchema>;
export type AxlHttpRequest = z.input<typeof axlHttpRequestSchema>;

export type HttpNodeResponse = {
  status: number;
  headers: Headers;
  body: Uint8Array;
};

export class HttpNodeClient {
  private readonly config: AxlNodeHttpClientConfig;

  constructor(config: AxlNodeHttpClientConfig) {
    this.config = axlNodeHttpClientConfigSchema.parse(config);
  }

  async getTopology(): Promise<Result<AxlTopologyResponse, Error>> {
    const response = await this.request({
      path: "/topology",
      method: "GET",
    });

    if (!response.ok) {
      return response;
    }

    try {
      const text = new TextDecoder().decode(response.value.body);
      const parsed = JSON.parse(text) as unknown;
      return ok(axlTopologyResponseSchema.parse(parsed));
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to parse AXL topology response."),
      );
    }
  }

  async send(input: {
    destinationPeerId: string;
    body: Uint8Array;
  }): Promise<Result<HttpNodeResponse, Error>> {
    return this.request({
      path: "/send",
      method: "POST",
      headers: {
        "X-Destination-Peer-Id": input.destinationPeerId,
      },
      body: input.body,
      contentType: "application/octet-stream",
    });
  }

  async recv(): Promise<Result<{ fromPeerId: string | null; body: Uint8Array } | null, Error>> {
    const response = await this.request({
      path: "/recv",
      method: "GET",
    });

    if (!response.ok) {
      return response;
    }

    if (response.value.status === 204) {
      return ok(null);
    }

    return ok({
      fromPeerId: response.value.headers.get("X-From-Peer-Id"),
      body: response.value.body,
    });
  }

  async callMcp(input: {
    peerId: string;
    service: string;
    request: Record<string, unknown>;
  }): Promise<Result<Record<string, unknown>, Error>> {
    return this.requestJson({
      path: `/mcp/${encodeURIComponent(input.peerId)}/${encodeURIComponent(input.service)}`,
      method: "POST",
      body: JSON.stringify(input.request),
      contentType: "application/json",
    });
  }

  async callA2A(input: {
    peerId: string;
    request: Record<string, unknown>;
  }): Promise<Result<Record<string, unknown>, Error>> {
    return this.requestJson({
      path: `/a2a/${encodeURIComponent(input.peerId)}`,
      method: "POST",
      body: JSON.stringify(input.request),
      contentType: "application/json",
    });
  }

  async request(input: AxlHttpRequest): Promise<Result<HttpNodeResponse, Error>> {
    const request = axlHttpRequestSchema.parse(input);
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.config.requestTimeoutMs);

    try {
      const requestBody =
        request.body instanceof Uint8Array
          ? new Blob([new Uint8Array(request.body)], {
              type: request.contentType ?? "application/octet-stream",
            })
          : request.body;

      const response = await fetch(this.resolveUrl(request.path), {
        method: request.method,
        headers: {
          ...this.config.defaultHeaders,
          ...(request.headers ?? {}),
          ...(request.contentType ? { "Content-Type": request.contentType } : {}),
        },
        body: requestBody,
        signal: controller.signal,
      });

      const body = new Uint8Array(await response.arrayBuffer());

      return ok({
        status: response.status,
        headers: response.headers,
        body,
      });
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("AXL HTTP request failed."),
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async requestJson(
    input: Pick<AxlHttpRequest, "path" | "method" | "body" | "contentType">,
  ): Promise<Result<Record<string, unknown>, Error>> {
    const response = await this.request({
      ...input,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return response;
    }

    try {
      const text = new TextDecoder().decode(response.value.body);
      const parsed = JSON.parse(text) as unknown;

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return err(new Error("Expected a JSON object response from AXL node."));
      }

      return ok(parsed as Record<string, unknown>);
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to parse JSON response from AXL node."),
      );
    }
  }

  private resolveUrl(path: string) {
    return new URL(path, this.config.baseUrl).toString();
  }
}
