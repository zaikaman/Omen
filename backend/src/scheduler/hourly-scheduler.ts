import { randomUUID } from "node:crypto";

import type { Logger } from "../bootstrap/logger.js";

import { RunLockError } from "./run-lock.js";
import type { RunLock } from "./run-lock.js";
import type { RuntimeModeFlags } from "./runtime-mode.js";

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
  loadLastRunAt?: () => Promise<string | null>;
  task: (context: SchedulerTaskContext) => Promise<void>;
  onTaskFailure?: (context: SchedulerTaskContext, error: unknown) => Promise<void>;
  pauseOnTaskFailure?: boolean;
};

export class HourlyScheduler {
  private readonly intervalMs: number;

  private timer: NodeJS.Timeout | null = null;

  private lastRunAt: string | null = null;

  private nextRunAt: string | null = null;

  private isRunning = false;

  private isStarted = false;

  private overlapPrevented = false;

  constructor(private readonly options: HourlySchedulerOptions) {
    this.intervalMs = options.intervalMs ?? 60 * 60 * 1000;
  }

  async start() {
    if (this.isStarted) {
      return;
    }

    this.isStarted = true;
    await this.scheduleNextTick();
  }

  async stop() {
    this.isStarted = false;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.nextRunAt = null;
  }

  getStatus(): SchedulerStatus {
    return {
      enabled: this.isStarted,
      isRunning: this.isRunning,
      nextRunAt: this.nextRunAt,
      lastRunAt: this.lastRunAt,
      scanIntervalMinutes: Math.floor(this.intervalMs / 60000),
      overlapPrevented: this.overlapPrevented,
    };
  }

  private async scheduleNextTick() {
    const delayMs = await this.resolveNextDelayMs();

    this.nextRunAt = new Date(Date.now() + delayMs).toISOString();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.tick("interval");
    }, delayMs);
  }

  private async resolveNextDelayMs() {
    if (!this.options.loadLastRunAt) {
      this.options.logger.info("No persisted scheduler run store configured. Running soon.");
      return this.resolveSoonDelayMs();
    }

    try {
      const persistedLastRunAt = await this.options.loadLastRunAt();
      const lastRunAt = this.resolveLatestRunAt(persistedLastRunAt, this.lastRunAt);

      if (!lastRunAt) {
        this.options.logger.info("No previous runs found. Running swarm soon.");
        return this.resolveSoonDelayMs();
      }

      this.lastRunAt = lastRunAt;

      const lastRunTime = new Date(lastRunAt).getTime();

      if (Number.isNaN(lastRunTime)) {
        this.options.logger.warn(`Ignoring invalid persisted scheduler timestamp: ${lastRunAt}`);
        return this.intervalMs;
      }

      const timeSinceLastRun = Date.now() - lastRunTime;
      const delayMs = Math.min(
        this.intervalMs,
        Math.max(this.resolveSoonDelayMs(), this.intervalMs - timeSinceLastRun),
      );

      if (timeSinceLastRun < this.intervalMs) {
        this.options.logger.info(
          `Last scheduled run was ${Math.round(timeSinceLastRun / 60000).toString()}m ago. Next run in ${Math.round(delayMs / 60000).toString()}m.`,
        );
      } else {
        this.options.logger.info(
          `Last scheduled run was ${Math.round(timeSinceLastRun / 60000).toString()}m ago. Running soon.`,
        );
      }

      return delayMs;
    } catch (error) {
      this.options.logger.error(
        "Failed to load persisted scheduler state. Falling back to interval delay.",
        error,
      );
      return this.intervalMs;
    }
  }

  private async tick(trigger: SchedulerTrigger) {
    const runId = `scheduled-${Date.now().toString()}-${randomUUID()}`;
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
      this.lastRunAt = triggeredAt;

      if (this.options.onTaskFailure) {
        try {
          await this.options.onTaskFailure(
            {
              runId,
              trigger,
              triggeredAt,
              mode: this.options.mode,
            },
            error,
          );
        } catch (notificationError) {
          this.options.logger.error("Scheduler failure notification failed.", notificationError);
        }
      }

      if (this.options.pauseOnTaskFailure) {
        await this.stop();
        this.options.logger.warn("Hourly scheduler paused after swarm failure.");
      }
    } finally {
      this.isRunning = false;

      if (this.isStarted && !this.timer) {
        await this.scheduleNextTick();
      }
    }
  }

  private resolveLatestRunAt(left: string | null, right: string | null) {
    if (!left) {
      return right;
    }

    if (!right) {
      return left;
    }

    const leftTime = new Date(left).getTime();
    const rightTime = new Date(right).getTime();

    if (Number.isNaN(leftTime)) {
      return right;
    }

    if (Number.isNaN(rightTime)) {
      return left;
    }

    return rightTime > leftTime ? right : left;
  }

  private resolveSoonDelayMs() {
    return Math.min(5000, this.intervalMs);
  }
}
