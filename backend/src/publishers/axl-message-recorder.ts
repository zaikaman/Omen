import type { AxlEnvelope, Result } from "@omen/shared";
import type { AxlMessagesRepository, RepositoryError } from "@omen/db";

export class AxlMessageRecorder {
  constructor(
    private readonly repository: AxlMessagesRepository,
  ) {}

  async recordMessage(
    message: AxlEnvelope,
  ): Promise<Result<AxlEnvelope, RepositoryError>> {
    return this.repository.createMessage(message);
  }

  async recordMessages(
    messages: AxlEnvelope[],
  ): Promise<Result<AxlEnvelope[], RepositoryError>> {
    const recorded: AxlEnvelope[] = [];

    for (const message of messages) {
      const result = await this.recordMessage(message);

      if (!result.ok) {
        return result;
      }

      recorded.push(result.value);
    }

    return {
      ok: true,
      value: recorded,
    };
  }

  async recordSendReceipt(
    message: AxlEnvelope,
  ): Promise<Result<AxlEnvelope, RepositoryError>> {
    return this.recordMessage({
      ...message,
      deliveryStatus: "sent",
    });
  }

  async recordReceiveReceipt(
    message: AxlEnvelope,
  ): Promise<Result<AxlEnvelope, RepositoryError>> {
    return this.recordMessage({
      ...message,
      deliveryStatus: "received",
    });
  }
}
