import type { BackendEnv } from "../bootstrap/env.js";
import type { Logger } from "../bootstrap/logger.js";

type LogSessionResponse = {
  logplex_url?: unknown;
};

export class HerokuLogFetcher {
  constructor(
    private readonly input: {
      env: Pick<BackendEnv, "heroku">;
      logger: Logger;
    },
  ) {}

  async fetchRecentLogs() {
    const { apiToken, appName } = this.input.env.heroku;

    if (!apiToken || !appName) {
      this.input.logger.warn(
        "Heroku logs skipped because HEROKU_API_TOKEN or HEROKU_APP_NAME is not configured.",
      );
      return null;
    }

    const logplexUrl = await this.createLogSession();
    const logs = await this.fetchLogplexUrl(logplexUrl);
    const trimmed = logs.trim();

    return trimmed.length > 0 ? trimmed : null;
  }

  private async createLogSession() {
    const { apiBaseUrl, apiToken, appName, logLineCount, requestTimeoutMs } =
      this.input.env.heroku;
    const response = await this.fetchWithTimeout(
      `${apiBaseUrl.replace(/\/$/, "")}/apps/${encodeURIComponent(appName ?? "")}/log-sessions`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.heroku+json; version=3",
          Authorization: `Bearer ${apiToken ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lines: logLineCount,
        }),
      },
      requestTimeoutMs,
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Heroku log session failed with HTTP ${response.status.toString()}${body ? `: ${body}` : ""}`,
      );
    }

    const payload = (await response.json()) as LogSessionResponse;

    if (typeof payload.logplex_url !== "string" || !payload.logplex_url) {
      throw new Error("Heroku log session response did not include logplex_url.");
    }

    return payload.logplex_url;
  }

  private async fetchLogplexUrl(logplexUrl: string) {
    const response = await this.fetchWithTimeout(
      logplexUrl,
      {
        method: "GET",
        headers: {
          Accept: "text/plain",
        },
      },
      this.input.env.heroku.requestTimeoutMs,
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Heroku Logplex fetch failed with HTTP ${response.status.toString()}${body ? `: ${body}` : ""}`,
      );
    }

    return response.text();
  }

  private async fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
