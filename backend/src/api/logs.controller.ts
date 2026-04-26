import type { Request, Response } from "express";

import { logFeedResponseSchema } from "@omen/shared";
import { demoRunBundles } from "@omen/db";

const parseLimit = (value: unknown, fallback: number) => {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const listLogs = (req: Request, res: Response) => {
  const runId = typeof req.query.runId === "string" ? req.query.runId : null;
  const limit = parseLimit(req.query.limit, 100);
  const items = demoRunBundles
    .flatMap((bundle) => bundle.events)
    .filter((event) => (runId ? event.runId === runId : true))
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
    .slice(0, limit);
  const data = logFeedResponseSchema.parse({
    items,
    nextCursor: null,
  });

  res.json({
    success: true,
    data,
  });
};
