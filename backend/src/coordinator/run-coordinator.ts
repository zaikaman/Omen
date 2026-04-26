import type { SwarmState } from "@omen/agents";

import type { Logger } from "../bootstrap/logger";
import type { SchedulerTaskContext } from "../scheduler/hourly-scheduler";

export type RunPipelineResult = {
  runId: string;
  completedAt: string;
  checkpointCount: number;
  outcomeType: NonNullable<SwarmState["run"]["outcome"]>["outcomeType"];
  finalState: SwarmState;
};

export type RunPipeline = {
  run(request: SchedulerTaskContext): Promise<RunPipelineResult>;
};

export type RunCoordinatorRequest = SchedulerTaskContext;

export type RunCoordinatorResult = {
  runId: string;
  completedAt: string;
  checkpointCount: number;
  outcomeType: NonNullable<SwarmState["run"]["outcome"]>["outcomeType"];
  finalState: SwarmState;
};

export type RunCoordinator = {
  executeScheduledRun(request: RunCoordinatorRequest): Promise<RunCoordinatorResult>;
};

export class DefaultRunCoordinator implements RunCoordinator {
  constructor(
    private readonly input: {
      logger: Logger;
      pipeline: RunPipeline;
    },
  ) {}

  async executeScheduledRun(request: RunCoordinatorRequest): Promise<RunCoordinatorResult> {
    this.input.logger.info(
      `Run coordinator starting ${request.runId} from ${request.trigger} in ${request.mode.label} mode.`,
    );

    const result = await this.input.pipeline.run(request);

    this.input.logger.info(
      `Run coordinator completed ${request.runId} with ${result.outcomeType} after ${result.checkpointCount.toString()} checkpoints.`,
    );

    return result;
  }
}

export const toRunCoordinatorResult = (
  result: RunPipelineResult,
): RunCoordinatorResult => ({
  runId: result.runId,
  completedAt: result.completedAt,
  checkpointCount: result.checkpointCount,
  outcomeType: result.outcomeType,
  finalState: result.finalState,
});
