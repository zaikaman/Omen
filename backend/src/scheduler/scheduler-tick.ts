import type { SchedulerTaskContext } from "./hourly-scheduler.js";
import type { RunCoordinator, RunCoordinatorResult } from "../coordinator/run-coordinator.js";

export type SchedulerTickHandler = (context: SchedulerTaskContext) => Promise<RunCoordinatorResult>;

export const createSchedulerTickHandler = (
  coordinator: RunCoordinator,
): SchedulerTickHandler => {
  return async (context) => coordinator.executeScheduledRun(context);
};
