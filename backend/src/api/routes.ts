import { Router } from "express";

import type { RuntimeMode, SchedulerStatus } from "@omen/shared";
import type { BackendEnv } from "../bootstrap/env.js";

import {
  createAnalyticsFeedController,
  createLatestAnalyticsController,
} from "./analytics.controller.js";
import {
  createDashboardSchedulerController,
  createDashboardSummaryController,
} from "./dashboard.controller.js";
import { healthCheck } from "./health.controller.js";
import {
  createIntelDetailController,
  createIntelFeedController,
} from "./intel.controller.js";
import { createInftController } from "./inft.controller.js";
import { createLogsController } from "./logs.controller.js";
import {
  createProofDetailController,
  createProofFeedController,
} from "./proofs.controller.js";
import {
  createPostsFeedController,
  createPostStatusController,
} from "./posts.controller.js";
import { createRunsController } from "./runs.controller.js";
import {
  createSignalDetailController,
  createSignalFeedController,
} from "./signals.controller.js";
import {
  createStatusController,
  type RuntimeStatusControllerContext,
} from "./status.controller.js";
import { createTopologyController } from "./topology.controller.js";

export type ApiRouterContext = RuntimeStatusControllerContext;

export const createApiRouter = (context: {
  env: BackendEnv;
  runtimeMode: RuntimeMode;
  getSchedulerStatus?: () => SchedulerStatus;
}) => {
  const router = Router();

  router.get("/health", healthCheck);
  router.get("/runs", createRunsController(context.env));
  router.get("/dashboard/summary", createDashboardSummaryController(context));
  router.get(
    "/dashboard/scheduler",
    createDashboardSchedulerController(context.getSchedulerStatus),
  );
  router.get("/status", createStatusController(context));
  router.get("/status/runtime", createStatusController(context));
  router.get("/logs", createLogsController(context.env));
  router.get("/analytics", createAnalyticsFeedController(context.env));
  router.get("/analytics/latest", createLatestAnalyticsController(context.env));
  router.get("/signals", createSignalFeedController(context.env));
  router.get("/signals/:id", createSignalDetailController(context.env));
  router.get("/intel", createIntelFeedController(context.env));
  router.get("/intel/:id", createIntelDetailController(context.env));
  router.get("/inft", createInftController(context.env));
  router.get("/topology", createTopologyController(context.env));
  router.get("/proofs", createProofFeedController(context.env));
  router.get("/proofs/:runId", createProofDetailController(context.env));
  router.get("/posts", createPostsFeedController(context.env));
  router.get("/posts/:id", createPostStatusController(context.env));

  return router;
};
