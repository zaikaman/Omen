import type { Request, Response } from "express";

import {
  runListItemSchema,
  runtimeModeSchema,
  schedulerStatusSchema,
  type RuntimeMode,
  type SchedulerStatus,
} from "@omen/shared";
import {
  demoRunBundles,
  demoSchedulerStatus,
} from "@omen/db";

export type RuntimeStatusControllerContext = {
  runtimeMode: RuntimeMode;
  getSchedulerStatus?: () => SchedulerStatus;
};

export const createStatusController = (
  context: RuntimeStatusControllerContext,
) => {
  return (_req: Request, res: Response) => {
    const latestRunBundle = demoRunBundles[demoRunBundles.length - 1] ?? null;
    const latestRun = latestRunBundle
      ? runListItemSchema.parse({
          id: latestRunBundle.run.id,
          mode: latestRunBundle.run.mode,
          status: latestRunBundle.run.status,
          marketBias: latestRunBundle.run.marketBias,
          startedAt: latestRunBundle.run.startedAt,
          completedAt: latestRunBundle.run.completedAt,
          triggeredBy: latestRunBundle.run.triggeredBy,
          finalSignalId: latestRunBundle.run.finalSignalId,
          finalIntelId: latestRunBundle.run.finalIntelId,
          failureReason: latestRunBundle.run.failureReason,
          outcome: latestRunBundle.run.outcome,
        })
      : null;
    const scheduler = schedulerStatusSchema.parse(
      context.getSchedulerStatus?.() ?? demoSchedulerStatus,
    );

    res.json({
      success: true,
      data: {
        runtimeMode: runtimeModeSchema.parse(context.runtimeMode),
        scheduler,
        activeRun: null,
        latestRun,
        lastCompletedRunId: latestRun?.id ?? null,
      },
    });
  };
};
