import type { Request, Response } from "express";

import { demoSchedulerStatus } from "@omen/db";
import { schedulerStatusSchema } from "@omen/shared";

import type { BackendEnv } from "../bootstrap/env";
import { buildDashboardSummaryReadModel } from "../read-models/dashboard-summary";

const resolveSchedulerStatus = (getSchedulerStatus?: () => unknown) =>
  schedulerStatusSchema.parse(getSchedulerStatus?.() ?? demoSchedulerStatus);

export const createDashboardSummaryController =
  (context: {
    env: Pick<BackendEnv, "supabase">;
    getSchedulerStatus?: () => unknown;
  }) =>
  async (_req: Request, res: Response) => {
    const scheduler = resolveSchedulerStatus(context.getSchedulerStatus);
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
    res.json({
      success: true,
      data: resolveSchedulerStatus(getSchedulerStatus),
    });
  };
