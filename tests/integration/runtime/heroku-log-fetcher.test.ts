import { afterEach, describe, expect, it, vi } from "vitest";

import type { Logger } from "../../../backend/src/bootstrap/logger";
import { HerokuLogFetcher } from "../../../backend/src/notifications/heroku-log-fetcher";

const createMockLogger = (): Logger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

describe("heroku log fetcher", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a Heroku log session and fetches the returned Logplex URL", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];

    vi.stubGlobal("fetch", async (input: string | URL, init?: RequestInit) => {
      const url = input.toString();
      requests.push({ url, init });

      if (url.includes("/log-sessions")) {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            logplex_url: "https://logplex.heroku.com/sessions/session-1",
          }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        text: async () =>
          "2026-04-29T14:50:09.345786+00:00 app[web.1]: Scheduler tick failed.",
      } as Response;
    });

    const fetcher = new HerokuLogFetcher({
      env: {
        heroku: {
          apiToken: "token-1",
          appName: "omen-backend",
          apiBaseUrl: "https://api.heroku.com",
          logLineCount: 120,
          requestTimeoutMs: 5000,
        },
      },
      logger: createMockLogger(),
    });

    const logs = await fetcher.fetchRecentLogs();

    expect(logs).toContain("Scheduler tick failed");
    expect(requests[0]?.url).toBe("https://api.heroku.com/apps/omen-backend/log-sessions");
    expect(requests[0]?.init?.headers).toMatchObject({
      Accept: "application/vnd.heroku+json; version=3",
      Authorization: "Bearer token-1",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({ lines: 120 });
    expect(requests[1]?.url).toBe("https://logplex.heroku.com/sessions/session-1");
  });

  it("skips Heroku logs when credentials are missing", async () => {
    const logger = createMockLogger();
    const fetcher = new HerokuLogFetcher({
      env: {
        heroku: {
          apiToken: null,
          appName: "omen-backend",
          apiBaseUrl: "https://api.heroku.com",
          logLineCount: 80,
          requestTimeoutMs: 5000,
        },
      },
      logger,
    });

    await expect(fetcher.fetchRecentLogs()).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      "Heroku logs skipped because HEROKU_API_TOKEN or HEROKU_APP_NAME is not configured.",
    );
  });
});
