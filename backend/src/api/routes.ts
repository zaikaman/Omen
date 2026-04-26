import { Router } from "express";

import type { RuntimeMode, SchedulerStatus } from "@omen/shared";

import { healthCheck } from "./health.controller";
import { listLogs } from "./logs.controller";
import { listRuns } from "./runs.controller";
import {
  createStatusController,
  type RuntimeStatusControllerContext,
} from "./status.controller";

export type ApiRouterContext = RuntimeStatusControllerContext;

export const createApiRouter = (context: {
  runtimeMode: RuntimeMode;
  getSchedulerStatus?: () => SchedulerStatus;
}) => {
  const router = Router();

  router.get("/health", healthCheck);
  router.get("/runs", listRuns);
  router.get("/status", createStatusController(context));
  router.get("/logs", listLogs);

  return router;
};
