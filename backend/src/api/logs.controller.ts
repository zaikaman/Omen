import type { Request, Response } from "express";

import {
  AgentEventsRepository,
  createSupabaseServiceRoleClient,
} from "@omen/db";

import type { BackendEnv } from "../bootstrap/env.js";
import { presentLogFeed } from "../presenters/logs.presenter.js";

const parseLimit = (value: unknown, defaultLimit: number) => {
  if (typeof value !== "string") {
    return defaultLimit;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 500) : defaultLimit;
};

const isPersistenceConfigured = (env: BackendEnv) =>
  Boolean(env.supabase.url && env.supabase.serviceRoleKey);

const createRepository = (env: BackendEnv) => {
  const client = createSupabaseServiceRoleClient({
    url: env.supabase.url ?? "",
    anonKey: env.supabase.anonKey ?? env.supabase.serviceRoleKey ?? "",
    serviceRoleKey: env.supabase.serviceRoleKey ?? "",
    schema: env.supabase.schema,
  });

  return new AgentEventsRepository(client);
};

export const createLogsController =
  (env: BackendEnv) => async (req: Request, res: Response) => {
    const runId = typeof req.query.runId === "string" ? req.query.runId : null;
    const limit = parseLimit(req.query.limit, 100);

    if (!isPersistenceConfigured(env)) {
      res.status(503).json({
        success: false,
        error: "Logs require a configured Supabase persistence backend.",
      });
      return;
    }

    const repository = createRepository(env);
    const listed = runId
      ? await repository.listByRunId(runId, limit)
      : await repository.listRecentEvents(limit);

    if (!listed.ok) {
      res.status(500).json({ success: false, error: listed.error.message });
      return;
    }

    res.json({
      success: true,
      data: presentLogFeed({ items: listed.value, nextCursor: null }),
    });
  };
