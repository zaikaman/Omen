import type { SchedulerTaskContext } from "./hourly-scheduler";
import type { RunCoordinator, RunCoordinatorResult } from "../coordinator/run-coordinator";

export type SchedulerTickHandler = (context: SchedulerTaskContext) => Promise<RunCoordinatorResult>;

export const createSchedulerTickHandler = (
  coordinator: RunCoordinator,
): SchedulerTickHandler => {
  return async (context) => coordinator.executeScheduledRun(context);
};
