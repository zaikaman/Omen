import type { Request, Response } from "express";

import { runListItemSchema } from "@omen/shared";
import { demoRunBundles } from "@omen/db";

export const listRuns = (_req: Request, res: Response) => {
  const runs = demoRunBundles.map(({ run }) =>
    runListItemSchema.parse({
      id: run.id,
      mode: run.mode,
      status: run.status,
      marketBias: run.marketBias,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      triggeredBy: run.triggeredBy,
      finalSignalId: run.finalSignalId,
      finalIntelId: run.finalIntelId,
      failureReason: run.failureReason,
      outcome: run.outcome,
    }),
  );

  res.json({
    success: true,
    data: {
      runs,
      nextCursor: null,
      total: runs.length,
    },
  });
};
