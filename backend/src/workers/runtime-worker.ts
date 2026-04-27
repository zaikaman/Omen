import type { Logger } from "../bootstrap/logger.js";
import type { BackendEnv } from "../bootstrap/env.js";
import type { RunCoordinator, RunCoordinatorResult } from "../coordinator/run-coordinator.js";
import type { SchedulerTaskContext } from "../scheduler/hourly-scheduler.js";
import { createSchedulerTickHandler, type SchedulerTickHandler } from "../scheduler/scheduler-tick.js";
import { SignalMonitorService } from "../services/signal-monitor.service.js";

export type RuntimeWorker = {
  execute(context: SchedulerTaskContext): Promise<RunCoordinatorResult>;
};

export class DefaultRuntimeWorker implements RuntimeWorker {
  private readonly tickHandler: SchedulerTickHandler;

  constructor(
    private readonly input: {
      logger: Logger;
      coordinator: RunCoordinator;
      env: BackendEnv;
    },
  ) {
    this.tickHandler = createSchedulerTickHandler(input.coordinator);
  }

  async execute(context: SchedulerTaskContext): Promise<RunCoordinatorResult> {
    this.input.logger.info(
      `Runtime worker dispatching scheduled run ${context.runId} at ${context.triggeredAt}.`,
    );

    const result = await this.tickHandler(context);

    if (context.mode.allowsExternalReads && context.mode.allowsExternalWrites) {
      const monitor = new SignalMonitorService({
        env: this.input.env,
        logger: this.input.logger,
      });
      const monitorResult = await monitor.checkActiveSignals();

      if (!monitorResult.ok) {
        this.input.logger.warn("Signal monitor failed.", monitorResult.error);
      }
    }

    this.input.logger.info(
      `Runtime worker finished ${result.runId} with ${result.outcomeType} at ${result.completedAt}.`,
    );

    return result;
  }
}
