import { randomUUID } from "node:crypto";

import type { SwarmState } from "@omen/agents";
import type { RunsRepository } from "@omen/db";

import type { Logger } from "../bootstrap/logger.js";
import type { SchedulerTaskContext } from "../scheduler/hourly-scheduler.js";

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

type FailedRunStore = Pick<RunsRepository, "deleteRunCascade">;

const createRetryRunId = () => `scheduled-${Date.now().toString()}-${randomUUID()}`;

export class DefaultRunCoordinator implements RunCoordinator {
  constructor(
    private readonly input: {
      logger: Logger;
      pipeline: RunPipeline;
      failedRunStore?: FailedRunStore | null;
      maxImmediateRetries?: number;
    },
  ) {}

  async executeScheduledRun(request: RunCoordinatorRequest): Promise<RunCoordinatorResult> {
    const maxImmediateRetries = this.input.maxImmediateRetries ?? 1;
    let currentRequest = request;

    for (let attempt = 0; attempt <= maxImmediateRetries; attempt += 1) {
      this.input.logger.info(
        `Run coordinator starting ${currentRequest.runId} from ${currentRequest.trigger} in ${currentRequest.mode.label} mode.`,
      );

      try {
        const result = await this.input.pipeline.run(currentRequest);

        this.input.logger.info(
          `Run coordinator completed ${currentRequest.runId} with ${result.outcomeType} after ${result.checkpointCount.toString()} checkpoints.`,
        );

        return result;
      } catch (error) {
        this.input.logger.error(
          `Run coordinator failed ${currentRequest.runId}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );

        await this.deleteFailedRun(currentRequest.runId);

        if (attempt >= maxImmediateRetries) {
          throw error;
        }

        currentRequest = {
          ...currentRequest,
          runId: createRetryRunId(),
          triggeredAt: new Date().toISOString(),
        };
        this.input.logger.warn(
          `Retrying failed scheduled run immediately as ${currentRequest.runId}.`,
        );
      }
    }

    throw new Error("Run coordinator exhausted retry attempts.");
  }

  private async deleteFailedRun(runId: string) {
    if (!this.input.failedRunStore) {
      this.input.logger.warn(
        `Failed run ${runId} could not be deleted because no run store is configured.`,
      );
      return;
    }

    const deleted = await this.input.failedRunStore.deleteRunCascade(runId);

    if (!deleted.ok) {
      throw new Error(`Failed to delete failed run ${runId}: ${deleted.error.message}`);
    }

    this.input.logger.info(`Deleted failed run ${runId}.`);
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
