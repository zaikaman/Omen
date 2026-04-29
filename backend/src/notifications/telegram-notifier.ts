import type { BackendEnv } from "../bootstrap/env.js";
import type { Logger } from "../bootstrap/logger.js";
import type { SchedulerTaskContext } from "../scheduler/hourly-scheduler.js";

export class TelegramNotifier {
  constructor(
    private readonly input: {
      env: Pick<BackendEnv, "telegram" | "nodeEnv">;
      logger: Logger;
    },
  ) {}

  async sendSwarmFailure(input: {
    context: SchedulerTaskContext;
    error: unknown;
    herokuLogs?: string | null;
  }) {
    const { botToken, chatId, baseUrl } = this.input.env.telegram;

    if (!botToken || !chatId) {
      this.input.logger.warn(
        "Telegram swarm failure notification skipped because TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured.",
      );
      return;
    }

    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: this.buildSwarmFailureMessage(input),
          disable_web_page_preview: true,
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Telegram sendMessage failed with HTTP ${response.status.toString()}${body ? `: ${body}` : ""}`,
      );
    }
  }

  private buildSwarmFailureMessage(input: {
    context: SchedulerTaskContext;
    error: unknown;
    herokuLogs?: string | null;
  }) {
    const error = this.normalizeError(input.error);
    const message = [
      "Omen swarm paused after failure.",
      "",
      `Environment: ${this.input.env.nodeEnv}`,
      `Mode: ${input.context.mode.label}`,
      `Run: ${input.context.runId}`,
      `Trigger: ${input.context.trigger}`,
      `Started: ${input.context.triggeredAt}`,
      `Detected: ${new Date().toISOString()}`,
      "",
      "Error:",
      error.message,
      "",
      input.herokuLogs ? "Heroku logs:" : "Error stack:",
      input.herokuLogs ?? error.stack ?? error.message,
    ].join("\n");

    return message.length > 3900 ? `${message.slice(0, 3897)}...` : message;
  }

  private normalizeError(error: unknown) {
    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
      };
    }

    return {
      message: String(error),
      stack: null,
    };
  }
}
