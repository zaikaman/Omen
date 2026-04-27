import type { AxlEnvelope, AxlPeerStatus } from "@omen/shared";
import { z } from "zod";

import { HttpNodeClient, type AxlNodeHttpClientConfig } from "../node-client/http-node-client.js";
import {
  createOmenMessage,
  deserializeOmenMessage,
  serializeOmenMessage,
  type OmenMessageBody,
} from "../message-envelope/omen-message.js";
import { toAxlPeerStatuses } from "../peer-status/peer-status.js";
import { err, ok, type Result } from "@omen/shared";

export const axlAdapterConfigSchema = z.object({
  node: z.object({
    baseUrl: z.string().url(),
    requestTimeoutMs: z.number().int().min(1).default(10_000),
    defaultHeaders: z.record(z.string(), z.string()).default({}),
  }),
});

export interface AxlAdapter {
  readonly client: HttpNodeClient;
  getPeerStatuses(): Promise<Result<AxlPeerStatus[], Error>>;
  sendMessage(input: {
    destinationPeerId: string;
    envelope: AxlEnvelope;
    body?: Record<string, unknown>;
  }): Promise<Result<void, Error>>;
  receiveMessage(): Promise<Result<OmenMessageBody | null, Error>>;
  callMcp(input: {
    peerId: string;
    service: string;
    request: Record<string, unknown>;
  }): Promise<Result<Record<string, unknown>, Error>>;
  callA2A(input: {
    peerId: string;
    request: Record<string, unknown>;
  }): Promise<Result<Record<string, unknown>, Error>>;
}

export class AxlHttpAdapter implements AxlAdapter {
  readonly client: HttpNodeClient;

  constructor(config: z.input<typeof axlAdapterConfigSchema>) {
    const parsed = axlAdapterConfigSchema.parse(config);
    this.client = new HttpNodeClient(parsed.node as AxlNodeHttpClientConfig);
  }

  async getPeerStatuses(): Promise<Result<AxlPeerStatus[], Error>> {
    const topology = await this.client.getTopology();

    if (!topology.ok) {
      return topology;
    }

    return ok(toAxlPeerStatuses(topology.value, new Date().toISOString()));
  }

  async sendMessage(input: {
    destinationPeerId: string;
    envelope: AxlEnvelope;
    body?: Record<string, unknown>;
  }): Promise<Result<void, Error>> {
    const payload = serializeOmenMessage({
      envelope: input.envelope,
      body: input.body ?? {},
    });

    const response = await this.client.send({
      destinationPeerId: input.destinationPeerId,
      body: new TextEncoder().encode(payload),
    });

    if (!response.ok) {
      return response;
    }

    if (response.value.status < 200 || response.value.status >= 300) {
      return err(
        new Error(`AXL send failed with HTTP ${response.value.status.toString()}.`),
      );
    }

    return ok(undefined);
  }

  async receiveMessage(): Promise<Result<OmenMessageBody | null, Error>> {
    const response = await this.client.recv();

    if (!response.ok) {
      return response;
    }

    if (response.value === null) {
      return ok(null);
    }

    const text = new TextDecoder().decode(response.value.body);
    const parsed = deserializeOmenMessage(text);

    if (!parsed.ok) {
      return parsed;
    }

    return ok(createOmenMessage(parsed.value));
  }

  async callMcp(input: {
    peerId: string;
    service: string;
    request: Record<string, unknown>;
  }) {
    return this.client.callMcp(input);
  }

  async callA2A(input: {
    peerId: string;
    request: Record<string, unknown>;
  }) {
    return this.client.callA2A(input);
  }
}

export type AxlAdapterConfig = z.infer<typeof axlAdapterConfigSchema>;
