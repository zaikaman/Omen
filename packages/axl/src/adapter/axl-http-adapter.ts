import { err, ok, type AxlEnvelope, type AxlPeerStatus, type Result } from "@omen/shared";

import { AxlHttpAdapter } from "./axl-adapter.js";
import {
  createOmenMessage,
  deserializeOmenMessage,
  type OmenMessageBody,
} from "../message-envelope/omen-message.js";

export type ReceivedAxlEnvelope = {
  fromPeerId: string | null;
  message: OmenMessageBody;
};

export class AxlHttpNodeAdapter extends AxlHttpAdapter {
  constructor(config: ConstructorParameters<typeof AxlHttpAdapter>[0]) {
    super(config);
  }

  async snapshotPeers(): Promise<Result<AxlPeerStatus[], Error>> {
    return this.getPeerStatuses();
  }

  async sendEnvelope(input: {
    destinationPeerId: string;
    envelope: AxlEnvelope;
    body?: Record<string, unknown>;
  }): Promise<Result<void, Error>> {
    return this.sendMessage(input);
  }

  async receiveEnvelope(): Promise<Result<ReceivedAxlEnvelope | null, Error>> {
    const response = await this.client.recv();

    if (!response.ok) {
      return response;
    }

    if (response.value === null) {
      return ok(null);
    }

    try {
      const text = new TextDecoder().decode(response.value.body);
      const parsed = deserializeOmenMessage(text);

      if (!parsed.ok) {
        return parsed;
      }

      return ok({
        fromPeerId: response.value.fromPeerId,
        message: createOmenMessage(parsed.value),
      });
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to parse received AXL envelope."),
      );
    }
  }
}
