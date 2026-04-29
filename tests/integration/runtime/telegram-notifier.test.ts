import { afterEach, describe, expect, it, vi } from "vitest";

import type { Logger } from "../../../backend/src/bootstrap/logger";
import { TelegramNotifier } from "../../../backend/src/notifications/telegram-notifier";
import { getRuntimeModeFlags } from "../../../backend/src/scheduler/runtime-mode";

const createMockLogger = (): Logger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

describe("telegram notifier", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("includes fetched Heroku logs in swarm failure messages", async () => {
    let requestBody: Record<string, unknown> | null = null;

    vi.stubGlobal("fetch", async (_input: string | URL, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;

      return {
        ok: true,
        status: 200,
        text: async () => "ok",
      } as Response;
    });

    const notifier = new TelegramNotifier({
      env: {
        nodeEnv: "production",
        telegram: {
          botToken: "bot-token",
          chatId: "@omen",
          baseUrl: "https://api.telegram.org",
        },
      },
      logger: createMockLogger(),
    });

    await notifier.sendSwarmFailure({
      context: {
        runId: "scheduled-1",
        trigger: "interval",
        triggeredAt: "2026-04-29T14:50:00.000Z",
        mode: getRuntimeModeFlags("live"),
      },
      error: new Error("Scanner could not collect live market snapshots."),
      herokuLogs:
        "2026-04-29T14:50:09.345786+00:00 app[web.1]: Scheduler tick failed.",
    });

    expect(requestBody?.text).toContain("Heroku logs:");
    expect(requestBody?.text).toContain("Scheduler tick failed");
    expect(requestBody?.text).toContain("Scanner could not collect live market snapshots.");
  });
});
