import type { Request, Response } from "express";

import { SignalsRepository, createSupabaseServiceRoleClient } from "@omen/db";
import type { Signal } from "@omen/shared";

import type { BackendEnv } from "../bootstrap/env";
import {
  presentSignalDetail,
  presentSignalFeed,
} from "../presenters/signals.presenter";

const parseLimit = (value: unknown, fallback: number) => {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 50) : fallback;
};

const createRepository = (env: BackendEnv) => {
  if (!env.supabase.url || !env.supabase.serviceRoleKey) {
    return null;
  }

  const client = createSupabaseServiceRoleClient({
    url: env.supabase.url,
    anonKey: env.supabase.anonKey ?? env.supabase.serviceRoleKey,
    serviceRoleKey: env.supabase.serviceRoleKey,
    schema: env.supabase.schema,
  });

  return new SignalsRepository(client);
};

const matchesQuery = (signal: Signal, query: string) =>
  [
    signal.asset,
    signal.direction,
    signal.whyNow,
    signal.uncertaintyNotes,
    signal.missingDataNotes,
    ...signal.confluences,
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);

export const createSignalFeedController =
  (env: BackendEnv) => async (req: Request, res: Response) => {
    const repository = createRepository(env);

    if (!repository) {
      res.json({
        success: true,
        data: presentSignalFeed({ items: [], total: 0, nextCursor: null }),
      });
      return;
    }

    const listed = await repository.listRecentSignals(parseLimit(req.query.limit, 20));

    if (!listed.ok) {
      res.status(500).json({ success: false, error: listed.error.message });
      return;
    }

    const query =
      typeof req.query.query === "string"
        ? req.query.query.trim().toLowerCase()
        : "";
    const status =
      typeof req.query.status === "string" ? req.query.status.trim() : "";
    const direction =
      typeof req.query.direction === "string" ? req.query.direction.trim() : "";
    const items = listed.value.filter((signal) => {
      if (query && !matchesQuery(signal, query)) {
        return false;
      }

      if (status && signal.signalStatus !== status) {
        return false;
      }

      if (direction && signal.direction !== direction) {
        return false;
      }

      return true;
    });

    res.json({
      success: true,
      data: presentSignalFeed({ items, total: items.length, nextCursor: null }),
    });
  };

export const createSignalDetailController =
  (env: BackendEnv) => async (req: Request, res: Response) => {
    const repository = createRepository(env);

    if (!repository) {
      res.status(404).json({
        success: false,
        error: "Signal persistence is not configured.",
      });
      return;
    }

    const signalId = typeof req.params.id === "string" ? req.params.id : "";
    const found = await repository.findSignalById(signalId);

    if (!found.ok) {
      res.status(500).json({ success: false, error: found.error.message });
      return;
    }

    if (!found.value) {
      res.status(404).json({ success: false, error: "Signal not found." });
      return;
    }

    res.json({
      success: true,
      data: presentSignalDetail(found.value),
    });
  };
