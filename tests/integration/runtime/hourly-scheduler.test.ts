import { afterEach, describe, expect, it, vi } from "vitest";

import { type Logger } from "../../../backend/src/bootstrap/logger.ts";
import { HourlyScheduler } from "../../../backend/src/scheduler/hourly-scheduler.ts";
import { RunLock } from "../../../backend/src/scheduler/run-lock.ts";
import { getRuntimeModeFlags } from "../../../backend/src/scheduler/runtime-mode.ts";

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
    const task = vi.fn(async () => undefined);
    const scheduler = new HourlyScheduler({
      logger,
      runLock: new RunLock(false),
      mode: getRuntimeModeFlags("mocked"),
      intervalMs: 1_000,
      task,
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

    expect(task).toHaveBeenCalledTimes(1);
    expect(task.mock.calls[0]?.[0]).toMatchObject({
      trigger: "interval",
      mode: {
        mode: "mocked",
        label: "Mocked demo",
      },
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
    let resolveTask: (() => void) | null = null;
    const task = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveTask = resolve;
        }),
    );

    const scheduler = new HourlyScheduler({
      logger,
      runLock: new RunLock(false),
      mode: getRuntimeModeFlags("mocked"),
      intervalMs: 1_000,
      task,
    });

    scheduler.start();

    await vi.advanceTimersByTimeAsync(1_000);
    await flushAsync();
    expect(task).toHaveBeenCalledTimes(1);
    expect(scheduler.getStatus().isRunning).toBe(true);

    await vi.advanceTimersByTimeAsync(1_000);
    await flushAsync();

    expect(task).toHaveBeenCalledTimes(1);
    expect(scheduler.getStatus().overlapPrevented).toBe(true);
    expect(logger.warn).toHaveBeenCalledTimes(1);

    resolveTask?.();
    await flushAsync();

    expect(scheduler.getStatus().isRunning).toBe(false);

    await scheduler.stop();
  });

  it("treats repeated scheduler starts as idempotent and avoids duplicate interval execution", async () => {
    vi.useFakeTimers();

    const logger = createMockLogger();
    const task = vi.fn(async () => undefined);
    const scheduler = new HourlyScheduler({
      logger,
      runLock: new RunLock(false),
      mode: getRuntimeModeFlags("mocked"),
      intervalMs: 1_000,
      task,
    });

    scheduler.start();
    scheduler.start();

    await vi.advanceTimersByTimeAsync(1_000);
    await flushAsync();

    expect(task).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);
    await flushAsync();

    expect(task).toHaveBeenCalledTimes(2);

    await scheduler.stop();
  });
});
