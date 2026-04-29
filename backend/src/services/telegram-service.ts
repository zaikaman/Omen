import type { BackendEnv } from "../bootstrap/env.js";
import type { Logger } from "../bootstrap/logger.js";
import { formatIntelPost, formatSignalPost } from "./x/post-formatter.js";
import type { Intel, Signal } from "@omen/shared";

const TELEGRAM_MESSAGE_LIMIT = 4096;
const REQUEST_TIMEOUT_MS = 15_000;

const trimToTelegramLimit = (value: string) => {
  if (value.length <= TELEGRAM_MESSAGE_LIMIT) {
    return value;
  }

  return `${value.slice(0, TELEGRAM_MESSAGE_LIMIT - 12).trimEnd()}\n\n[truncated]`;
};

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/g, "");

const joinUrl = (baseUrl: string, path: string) =>
  `${baseUrl.replace(/\/+$/g, "")}/${path.replace(/^\/+/g, "")}`;

const hasPlaceholderValue = (value: string) =>
  /^your[_-]/i.test(value) || value === "@YourTelegramChannel";

const buildIntelUrl = (env: BackendEnv, intel: Intel) =>
  joinUrl(env.frontendOrigin, `/app/intel/${intel.id}`);

export class TelegramService {
  private readonly botToken: string | null;
  private readonly chatId: string | null;
  private readonly apiBaseUrl: string;

  constructor(
    private readonly input: {
      env: BackendEnv;
      logger: Logger;
    },
  ) {
    this.botToken = input.env.telegram.botToken;
    this.chatId = input.env.telegram.chatId;
    this.apiBaseUrl = normalizeBaseUrl(input.env.telegram.baseUrl);
  }

  get enabled() {
    return Boolean(
      this.botToken &&
        this.chatId &&
        !hasPlaceholderValue(this.botToken) &&
        !hasPlaceholderValue(this.chatId),
    );
  }

  async sendSignal(signal: Signal) {
    return this.sendMessage(formatSignalPost(signal).text, "signal", signal.id);
  }

  async sendIntel(intel: Intel) {
    const headline = intel.title.trim();
    const tldr = intel.summary.trim() || formatIntelPost(intel).text.trim();
    const message = [
      headline,
      "",
      tldr,
      "",
      `View full intel: ${buildIntelUrl(this.input.env, intel)}`,
    ].join("\n");

    return this.sendMessage(message, "intel", intel.id);
  }

  private async sendMessage(message: string, kind: "signal" | "intel", recordId: string) {
    if (!this.enabled) {
      this.input.logger.warn("telegram post skipped; bot token or chat id is not configured.", {
        kind,
        recordId,
      });
      return false;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.apiBaseUrl}/bot${this.botToken}/sendMessage`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: trimToTelegramLimit(message),
          disable_web_page_preview: false,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        this.input.logger.warn("telegram post failed.", {
          kind,
          recordId,
          status: response.status,
          body: body.slice(0, 500),
        });
        return false;
      }

      this.input.logger.info("telegram post sent.", {
        kind,
        recordId,
        chatId: this.chatId,
      });
      return true;
    } catch (error) {
      this.input.logger.warn("telegram post failed.", {
        kind,
        recordId,
        error: error instanceof Error ? error.message : "Unknown Telegram error.",
      });
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }
}
