import type { Request, Response } from "express";

import { IntelsRepository, createSupabaseServiceRoleClient } from "@omen/db";
import {
  intelDetailResponseSchema,
  intelFeedResponseSchema,
} from "@omen/shared";

import type { BackendEnv } from "../bootstrap/env";

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

  return new IntelsRepository(client);
};

export const createIntelFeedController =
  (env: BackendEnv) => async (req: Request, res: Response) => {
    const repository = createRepository(env);

    if (!repository) {
      res.json({
        success: true,
        data: intelFeedResponseSchema.parse({ items: [], nextCursor: null }),
      });
      return;
    }

    const listed = await repository.listRecentIntel(parseLimit(req.query.limit, 20));

    if (!listed.ok) {
      res.status(500).json({ success: false, error: listed.error.message });
      return;
    }

    const query =
      typeof req.query.query === "string"
        ? req.query.query.trim().toLowerCase()
        : "";
    const items = query
      ? listed.value.filter((intel) =>
          [intel.title, intel.summary, intel.body, ...intel.symbols]
            .join(" ")
            .toLowerCase()
            .includes(query),
        )
      : listed.value;

    res.json({
      success: true,
      data: intelFeedResponseSchema.parse({ items, nextCursor: null }),
    });
  };

export const createIntelDetailController =
  (env: BackendEnv) => async (req: Request, res: Response) => {
    const repository = createRepository(env);

    if (!repository) {
      res.status(404).json({
        success: false,
        error: "Intel persistence is not configured.",
      });
      return;
    }

    const intelId = typeof req.params.id === "string" ? req.params.id : "";
    const found = await repository.findIntelById(intelId);

    if (!found.ok) {
      res.status(500).json({ success: false, error: found.error.message });
      return;
    }

    if (!found.value) {
      res.status(404).json({ success: false, error: "Intel not found." });
      return;
    }

    res.json({
      success: true,
      data: intelDetailResponseSchema.parse({ item: found.value }),
    });
  };
