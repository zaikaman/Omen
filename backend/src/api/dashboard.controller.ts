import type { Request, Response } from "express";

import { schedulerStatusSchema } from "@omen/shared";

import type { BackendEnv } from "../bootstrap/env.js";
import { buildDashboardSummaryReadModel } from "../read-models/dashboard-summary.js";

const resolveSchedulerStatus = (getSchedulerStatus?: () => unknown) =>
  getSchedulerStatus ? schedulerStatusSchema.parse(getSchedulerStatus()) : null;

export const createDashboardSummaryController =
  (context: {
    env: Pick<BackendEnv, "supabase">;
    getSchedulerStatus?: () => unknown;
  }) =>
  async (_req: Request, res: Response) => {
    const scheduler = resolveSchedulerStatus(context.getSchedulerStatus);

    if (!scheduler) {
      res.status(503).json({
        success: false,
        error: "Scheduler status is not available from the live runtime.",
      });
      return;
    }

    const summary = await buildDashboardSummaryReadModel({
      env: context.env,
      scheduler,
    });

    if (!summary.ok) {
      res.status(500).json({ success: false, error: summary.error.message });
      return;
    }

    res.json({
      success: true,
      data: summary.value,
    });
  };

export const createDashboardSchedulerController =
  (getSchedulerStatus?: () => unknown) => (_req: Request, res: Response) => {
    const scheduler = resolveSchedulerStatus(getSchedulerStatus);

    if (!scheduler) {
      res.status(503).json({
        success: false,
        error: "Scheduler status is not available from the live runtime.",
      });
      return;
    }

    res.json({
      success: true,
      data: scheduler,
    });
  };
