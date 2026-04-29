import type { Request, Response } from "express";

import type { BackendEnv } from "../bootstrap/env.js";
import {
  presentAnalyticsFeed,
  presentLatestAnalyticsSnapshot,
} from "../presenters/analytics.presenter.js";
import {
  buildAnalyticsSnapshotsReadModel,
  buildLatestAnalyticsSnapshotReadModel,
} from "../read-models/analytics-snapshots.js";

const parseLimit = (value: unknown, defaultLimit: number) => {
  if (typeof value !== "string") {
    return defaultLimit;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : defaultLimit;
};

export const createAnalyticsFeedController =
  (env: BackendEnv) => async (req: Request, res: Response) => {
    const snapshots = await buildAnalyticsSnapshotsReadModel({ env });

    if (!snapshots.ok) {
      res.status(500).json({ success: false, error: snapshots.error.message });
      return;
    }

    res.json({
      success: true,
      data: presentAnalyticsFeed({
        items: snapshots.value.slice(-parseLimit(req.query.limit, 50)),
        nextCursor: null,
      }),
    });
  };

export const createLatestAnalyticsController =
  (env: BackendEnv) => async (_req: Request, res: Response) => {
    const snapshot = await buildLatestAnalyticsSnapshotReadModel({ env });

    if (!snapshot.ok) {
      res.status(500).json({ success: false, error: snapshot.error.message });
      return;
    }

    res.json({
      success: true,
      data: presentLatestAnalyticsSnapshot(snapshot.value),
    });
  };
