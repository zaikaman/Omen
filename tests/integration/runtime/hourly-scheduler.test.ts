import { afterEach, describe, expect, it, vi } from "vitest";

import { type Logger } from "../../../backend/src/bootstrap/logger";
import { HourlyScheduler } from "../../../backend/src/scheduler/hourly-scheduler";
import { RunLock } from "../../../backend/src/scheduler/run-lock";
import { getRuntimeModeFlags } from "../../../backend/src/scheduler/runtime-mode";

const createMockLogger = (): Logger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

const flushAsync = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("hourly scheduler", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs the scheduled task on interval ticks and updates scheduler status", async () => {
    vi.useFakeTimers();

    const logger = createMockLogger();
    const taskCalls: Array<{ trigger: string; modeLabel: string }> = [];
    const scheduler = new HourlyScheduler({
      logger,
      runLock: new RunLock(false),
      mode: getRuntimeModeFlags("mocked"),
      intervalMs: 1_000,
      task: async (context) => {
        taskCalls.push({
          trigger: context.trigger,
          modeLabel: context.mode.label,
        });
      },
    });

    scheduler.start();

    expect(scheduler.getStatus()).toMatchObject({
      enabled: true,
      isRunning: false,
      scanIntervalMinutes: 0,
      overlapPrevented: false,
    });

    await vi.advanceTimersByTimeAsync(1_000);
    await flushAsync();

    expect(taskCalls).toHaveLength(1);
    expect(taskCalls[0]).toMatchObject({
      trigger: "interval",
      modeLabel: "Mocked demo",
    });

    const status = scheduler.getStatus();
    expect(status.enabled).toBe(true);
    expect(status.isRunning).toBe(false);
    expect(status.lastRunAt).not.toBeNull();
    expect(status.nextRunAt).not.toBeNull();

    await scheduler.stop();
  });

  it("prevents overlapping interval ticks when the current run is still active", async () => {
    vi.useFakeTimers();

    const logger = createMockLogger();
    let resolveTask: () => void = () => undefined;
    let taskCalls = 0;

    const scheduler = new HourlyScheduler({
      logger,
      runLock: new RunLock(false),
      mode: getRuntimeModeFlags("mocked"),
      intervalMs: 1_000,
      task: () => {
        taskCalls += 1;
        return new Promise<void>((resolve) => {
          resolveTask = resolve;
        });
      },
    });

    scheduler.start();

    await vi.advanceTimersByTimeAsync(1_000);
    await flushAsync();
    expect(taskCalls).toBe(1);
    expect(scheduler.getStatus().isRunning).toBe(true);

    await vi.advanceTimersByTimeAsync(1_000);
    await flushAsync();

    expect(taskCalls).toBe(1);
    expect(scheduler.getStatus().overlapPrevented).toBe(true);
    expect(logger.warn).toHaveBeenCalledTimes(1);

    resolveTask();
    await flushAsync();

    expect(scheduler.getStatus().isRunning).toBe(false);

    await scheduler.stop();
  });

  it("treats repeated scheduler starts as idempotent and avoids duplicate interval execution", async () => {
    vi.useFakeTimers();

    const logger = createMockLogger();
    let taskCalls = 0;
    const scheduler = new HourlyScheduler({
      logger,
      runLock: new RunLock(false),
      mode: getRuntimeModeFlags("mocked"),
      intervalMs: 1_000,
      task: async () => {
        taskCalls += 1;
      },
    });

    scheduler.start();
    scheduler.start();

    await vi.advanceTimersByTimeAsync(1_000);
    await flushAsync();

    expect(taskCalls).toBe(1);

    await vi.advanceTimersByTimeAsync(1_000);
    await flushAsync();

    expect(taskCalls).toBe(2);

    await scheduler.stop();
  });
});
