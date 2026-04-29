import type { Request, Response } from "express";

import {
  OutboundPostsRepository,
  createSupabaseServiceRoleClient,
} from "@omen/db";
import {
  postFeedResponseSchema,
  postStatusResponseSchema,
} from "@omen/shared";

import type { BackendEnv } from "../bootstrap/env.js";

const parseLimit = (value: unknown, defaultLimit: number) => {
  if (typeof value !== "string") {
    return defaultLimit;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 50) : defaultLimit;
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

  return new OutboundPostsRepository(client);
};

export const createPostsFeedController =
  (env: Pick<BackendEnv, "supabase">) => async (req: Request, res: Response) => {
    const limit = parseLimit(req.query.limit, 20);
    const runId = typeof req.query.runId === "string" ? req.query.runId : undefined;
    const signalId =
      typeof req.query.signalId === "string" ? req.query.signalId : undefined;
    const intelId =
      typeof req.query.intelId === "string" ? req.query.intelId : undefined;
    const repository = createRepository(env);

    if (!repository) {
      res.status(503).json({
        success: false,
        error: "Posts require a configured Supabase persistence backend.",
      });
      return;
    }

    const listed = await repository.listByLinkedRecord({
      runId,
      signalId,
      intelId,
      limit,
    });

    if (!listed.ok) {
      res.status(500).json({ success: false, error: listed.error.message });
      return;
    }

    res.json({
      success: true,
      data: postFeedResponseSchema.parse({ items: listed.value }),
    });
  };

export const createPostStatusController =
  (env: Pick<BackendEnv, "supabase">) => async (req: Request, res: Response) => {
    const postId = typeof req.params.id === "string" ? req.params.id : "";
    const repository = createRepository(env);

    if (!repository) {
      res.status(503).json({
        success: false,
        error: "Post status requires a configured Supabase persistence backend.",
      });
      return;
    }

    const found = await repository.findPostById(postId);

    if (!found.ok) {
      res.status(500).json({ success: false, error: found.error.message });
      return;
    }

    if (!found.value) {
      res.status(404).json({ success: false, error: "Post not found." });
      return;
    }

    res.json({
      success: true,
      data: postStatusResponseSchema.parse({ item: found.value }),
    });
  };
