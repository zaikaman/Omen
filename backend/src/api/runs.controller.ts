import type { Request, Response } from "express";

import { RunsRepository, createSupabaseServiceRoleClient } from "@omen/db";

import type { BackendEnv } from "../bootstrap/env.js";
import { presentRunListItem } from "../presenters/dashboard.presenter.js";

const parseLimit = (value: unknown, defaultLimit: number) => {
  if (typeof value !== "string") {
    return defaultLimit;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : defaultLimit;
};

const createRepository = (env: Pick<BackendEnv, "supabase">) => {
  if (!env.supabase.url || !env.supabase.serviceRoleKey) {
    return null;
  }

  const client = createSupabaseServiceRoleClient({
    url: env.supabase.url,
    anonKey: env.supabase.anonKey ?? env.supabase.serviceRoleKey,
    serviceRoleKey: env.supabase.serviceRoleKey,
    schema: env.supabase.schema,
  });

  return new RunsRepository(client);
};

export const createRunsController =
  (env: Pick<BackendEnv, "supabase">) => async (req: Request, res: Response) => {
    const repository = createRepository(env);

    if (!repository) {
      res.status(503).json({
        success: false,
        error: "Runs require a configured Supabase persistence backend.",
      });
      return;
    }

    const limit = parseLimit(req.query.limit, 20);
    const listed = await repository.listRecentRuns(limit);

    if (!listed.ok) {
      res.status(500).json({ success: false, error: listed.error.message });
      return;
    }

    const traceTimings = await repository.listTraceTimingsByRunIds(
      listed.value.map((run) => run.id),
    );

    if (!traceTimings.ok) {
      res.status(500).json({ success: false, error: traceTimings.error.message });
      return;
    }

    res.json({
      success: true,
      data: {
        runs: listed.value.map((run) =>
          presentRunListItem(run, traceTimings.value.get(run.id) ?? null),
        ),
        nextCursor: null,
        total: listed.value.length,
      },
    });
  };
