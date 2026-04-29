import type { Request, Response } from "express";

import {
  schedulerStatusSchema,
  type RuntimeMode,
  type SchedulerStatus,
} from "@omen/shared";

import type { BackendEnv } from "../bootstrap/env.js";
import { buildRuntimeStatusReadModel } from "../read-models/runtime-status.js";

export type RuntimeStatusControllerContext = {
  env: Pick<BackendEnv, "supabase">;
  runtimeMode: RuntimeMode;
  getSchedulerStatus?: () => SchedulerStatus;
};

export const createStatusController = (
  context: RuntimeStatusControllerContext,
) => async (_req: Request, res: Response) => {
  if (!context.getSchedulerStatus) {
    res.status(503).json({
      success: false,
      error: "Runtime status requires a live scheduler.",
    });
    return;
  }

  const scheduler = schedulerStatusSchema.parse(context.getSchedulerStatus());
  const runtimeStatus = await buildRuntimeStatusReadModel({
    env: context.env,
    runtimeMode: context.runtimeMode,
    scheduler,
  });

  if (!runtimeStatus.ok) {
    res.status(500).json({ success: false, error: runtimeStatus.error.message });
    return;
  }

  res.json({
    success: true,
    data: {
      ...runtimeStatus.value,
      activeRunId: runtimeStatus.value.activeRun?.id ?? null,
    },
  });
};
