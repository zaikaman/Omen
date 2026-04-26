import type { Logger } from "../bootstrap/logger";

import { RunLockError } from "./run-lock";
import type { RunLock } from "./run-lock";
import type { RuntimeModeFlags } from "./runtime-mode";

export type SchedulerTrigger = "interval";

export type SchedulerTaskContext = {
  runId: string;
  trigger: SchedulerTrigger;
  triggeredAt: string;
  mode: RuntimeModeFlags;
};

export type SchedulerStatus = {
  enabled: boolean;
  isRunning: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  scanIntervalMinutes: number;
  overlapPrevented: boolean;
};

export type HourlySchedulerOptions = {
  logger: Logger;
  runLock: RunLock;
  mode: RuntimeModeFlags;
  intervalMs?: number;
  task: (context: SchedulerTaskContext) => Promise<void>;
};

export class HourlyScheduler {
  private readonly intervalMs: number;

  private timer: NodeJS.Timeout | null = null;

  private lastRunAt: string | null = null;

  private nextRunAt: string | null = null;

  private isRunning = false;

  private overlapPrevented = false;

  constructor(private readonly options: HourlySchedulerOptions) {
    this.intervalMs = options.intervalMs ?? 60 * 60 * 1000;
  }

  start() {
    if (this.timer) {
      return;
    }

    this.scheduleNextTick();

    this.timer = setInterval(() => {
      void this.tick("interval");
    }, this.intervalMs);
  }

  async stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.nextRunAt = null;
  }

  getStatus(): SchedulerStatus {
    return {
      enabled: this.timer !== null,
      isRunning: this.isRunning,
      nextRunAt: this.nextRunAt,
      lastRunAt: this.lastRunAt,
      scanIntervalMinutes: Math.floor(this.intervalMs / 60000),
      overlapPrevented: this.overlapPrevented,
    };
  }

  private scheduleNextTick() {
    this.nextRunAt = new Date(Date.now() + this.intervalMs).toISOString();
  }

  private async tick(trigger: SchedulerTrigger) {
    const runId = `scheduled-${Date.now().toString()}`;
    const triggeredAt = new Date().toISOString();

    this.overlapPrevented = false;

    try {
      this.isRunning = true;

      await this.options.runLock.withRunLock(runId, async () => {
        this.options.logger.info(
          `Scheduler tick started (${trigger}) in ${this.options.mode.label} mode.`,
        );

        await this.options.task({
          runId,
          trigger,
          triggeredAt,
          mode: this.options.mode,
        });

        this.lastRunAt = triggeredAt;
        this.options.logger.info(`Scheduler tick completed for ${runId}.`);
      });
    } catch (error) {
      if (error instanceof RunLockError) {
        this.overlapPrevented = true;
        this.options.logger.warn(error.message);
        return;
      }

      this.options.logger.error("Scheduler tick failed.", error);
    } finally {
      this.isRunning = false;

      if (this.timer) {
        this.scheduleNextTick();
      }
    }
  }
}
