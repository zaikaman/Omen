import {
  axlA2ADelegationEnvelopeSchema,
  err,
  ok,
  type AxlA2ADelegationEnvelope,
  type AxlA2ADelegationRequest,
  type Result,
} from "@omen/shared";

import { createDelegationRequest } from "./delegation-contract.js";
import type { AxlAdapter } from "../adapter/axl-adapter.js";

type A2ATransport = Pick<AxlAdapter, "callA2A">;

export class AxlA2AClient {
  constructor(private readonly transport: A2ATransport) {}

  async delegate(input: {
    peerId: string;
    request: AxlA2ADelegationRequest;
  }): Promise<Result<AxlA2ADelegationEnvelope, Error>> {
    const request = createDelegationRequest(input.request);
    const response = await this.transport.callA2A({
      peerId: input.peerId,
      request,
    });

    if (!response.ok) {
      return response;
    }

    return this.parseEnvelope(response.value);
  }

  parseEnvelope(
    value: Record<string, unknown>,
  ): Result<AxlA2ADelegationEnvelope, Error> {
    try {
      return ok(axlA2ADelegationEnvelopeSchema.parse(value));
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to parse AXL A2A delegation envelope."),
      );
    }
  }
}
