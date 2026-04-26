import type { Logger } from "../bootstrap/logger";
import type { RunCoordinator, RunCoordinatorResult } from "../coordinator/run-coordinator";
import type { SchedulerTaskContext } from "../scheduler/hourly-scheduler";
import { createSchedulerTickHandler, type SchedulerTickHandler } from "../scheduler/scheduler-tick";

export type RuntimeWorker = {
  execute(context: SchedulerTaskContext): Promise<RunCoordinatorResult>;
};

export class DefaultRuntimeWorker implements RuntimeWorker {
  private readonly tickHandler: SchedulerTickHandler;

  constructor(
    private readonly input: {
      logger: Logger;
      coordinator: RunCoordinator;
    },
  ) {
    this.tickHandler = createSchedulerTickHandler(input.coordinator);
  }

  async execute(context: SchedulerTaskContext): Promise<RunCoordinatorResult> {
    this.input.logger.info(
      `Runtime worker dispatching scheduled run ${context.runId} at ${context.triggeredAt}.`,
    );

    const result = await this.tickHandler(context);

    this.input.logger.info(
      `Runtime worker finished ${result.runId} with ${result.outcomeType} at ${result.completedAt}.`,
    );

    return result;
  }
}
