import type { Request, Response } from "express";

import {
  AgentEventsRepository,
  createSupabaseServiceRoleClient,
  demoRunBundles,
} from "@omen/db";

import type { BackendEnv } from "../bootstrap/env.js";
import { presentLogFeed } from "../presenters/logs.presenter.js";

const parseLimit = (value: unknown, fallback: number) => {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 500) : fallback;
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
      const items = demoRunBundles
        .flatMap((bundle) => bundle.events)
        .filter((event) => (runId ? event.runId === runId : true))
        .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
        .slice(0, limit);

      res.json({
        success: true,
        data: presentLogFeed({ items, nextCursor: null }),
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

    const items = runId ? listed.value : [...listed.value].reverse();

    res.json({
      success: true,
      data: presentLogFeed({ items, nextCursor: null }),
    });
  };
