import type { Request, Response } from "express";

import { SignalsRepository, createSupabaseServiceRoleClient } from "@omen/db";
import {
  SIGNAL_DIRECTION_VALUES,
  SIGNAL_STATUS_VALUES,
  type Signal,
} from "@omen/shared";

import type { BackendEnv } from "../bootstrap/env.js";
import {
  presentSignalDetail,
  presentSignalFeed,
} from "../presenters/signals.presenter.js";

const parseLimit = (value: unknown, defaultLimit: number) => {
  if (typeof value !== "string") {
    return defaultLimit;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 50) : defaultLimit;
};

const SIGNAL_SORT_VALUES = [
  "newest",
  "oldest",
  "confidence-high",
  "confidence-low",
  "pnl-high",
  "pnl-low",
] as const;

type SignalSort = (typeof SIGNAL_SORT_VALUES)[number];

const parsePage = (value: unknown) => {
  if (typeof value !== "string") {
    return 1;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

const parseSort = (value: unknown): SignalSort =>
  typeof value === "string" &&
  SIGNAL_SORT_VALUES.includes(value as SignalSort)
    ? (value as SignalSort)
    : "newest";

const parseStatus = (value: unknown): Signal["signalStatus"] | null =>
  typeof value === "string" &&
  value !== "all" &&
  SIGNAL_STATUS_VALUES.includes(value as NonNullable<Signal["signalStatus"]>)
    ? (value as Signal["signalStatus"])
    : null;

const parseDirection = (value: unknown): Signal["direction"] | null => {
  if (typeof value !== "string" || value === "all") {
    return null;
  }

  const direction = value.toUpperCase();
  return SIGNAL_DIRECTION_VALUES.includes(direction as Signal["direction"])
    ? (direction as Signal["direction"])
    : null;
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

export const createSignalFeedController =
  (env: BackendEnv) => async (req: Request, res: Response) => {
    const repository = createRepository(env);
    const limit = parseLimit(req.query.limit, 20);
    const page = parsePage(req.query.page);

    if (!repository) {
      res.json({
        success: true,
        data: presentSignalFeed({ items: [], total: 0, nextCursor: null }),
      });
      return;
    }

    const listed = await repository.listSignalHistory({
      direction: parseDirection(req.query.direction),
      limit,
      offset: (page - 1) * limit,
      query: typeof req.query.query === "string" ? req.query.query : null,
      sortBy: parseSort(req.query.sort),
      status: parseStatus(req.query.status),
    });

    if (!listed.ok) {
      res.status(500).json({ success: false, error: listed.error.message });
      return;
    }

    const nextCursor =
      page * limit < listed.value.total ? String(page + 1) : null;

    res.json({
      success: true,
      data: presentSignalFeed({
        items: listed.value.items,
        total: listed.value.total,
        nextCursor,
      }),
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
