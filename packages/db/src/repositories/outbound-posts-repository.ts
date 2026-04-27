import {
  err,
  ok,
  outboundPostSchema,
  type OutboundPost,
  type PostStatus,
  type Result,
} from "@omen/shared";

import {
  BaseRepository,
  type RepositoryError,
} from "./base-repository.js";
import type { OmenSupabaseClient } from "../client/supabase.js";
import { normalizeDatabaseTimestamp } from "./timestamp.js";

type OutboundPostRow = {
  id: string;
  run_id: string;
  signal_id: string | null;
  intel_id: string | null;
  target: OutboundPost["target"];
  kind: OutboundPost["kind"];
  status: OutboundPost["status"];
  payload: OutboundPost["payload"];
  provider: string;
  provider_post_id: string | null;
  published_url: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

type OutboundPostInsert = {
  id?: string;
  run_id: string;
  signal_id?: string | null;
  intel_id?: string | null;
  target: OutboundPost["target"];
  kind: OutboundPost["kind"];
  status: OutboundPost["status"];
  payload: OutboundPost["payload"];
  provider: string;
  provider_post_id?: string | null;
  published_url?: string | null;
  last_error?: string | null;
  created_at?: string;
  updated_at?: string;
  published_at?: string | null;
};

type OutboundPostUpdate = Partial<OutboundPostInsert>;

const toOutboundPost = (row: OutboundPostRow): OutboundPost =>
  outboundPostSchema.parse({
    id: row.id,
    runId: row.run_id,
    signalId: row.signal_id,
    intelId: row.intel_id,
    target: row.target,
    kind: row.kind,
    status: row.status,
    payload: row.payload,
    provider: row.provider,
    providerPostId: row.provider_post_id,
    publishedUrl: row.published_url,
    lastError: row.last_error,
    createdAt: normalizeDatabaseTimestamp(row.created_at),
    updatedAt: normalizeDatabaseTimestamp(row.updated_at),
    publishedAt: normalizeDatabaseTimestamp(row.published_at),
  });

const toInsertRow = (post: OutboundPost): OutboundPostInsert => ({
  id: post.id,
  run_id: post.runId,
  signal_id: post.signalId,
  intel_id: post.intelId,
  target: post.target,
  kind: post.kind,
  status: post.status,
  payload: post.payload,
  provider: post.provider,
  provider_post_id: post.providerPostId,
  published_url: post.publishedUrl,
  last_error: post.lastError,
  created_at: post.createdAt,
  updated_at: post.updatedAt,
  published_at: post.publishedAt,
});

const toUpdateRow = (patch: Partial<OutboundPost>): OutboundPostUpdate => ({
  run_id: patch.runId,
  signal_id: patch.signalId,
  intel_id: patch.intelId,
  target: patch.target,
  kind: patch.kind,
  status: patch.status,
  payload: patch.payload,
  provider: patch.provider,
  provider_post_id: patch.providerPostId,
  published_url: patch.publishedUrl,
  last_error: patch.lastError,
  created_at: patch.createdAt,
  updated_at: patch.updatedAt,
  published_at: patch.publishedAt,
});

const withoutUndefined = <T extends Record<string, unknown>>(input: T): T =>
  Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as T;

export class OutboundPostsRepository extends BaseRepository<
  OutboundPostRow,
  OutboundPostInsert,
  OutboundPostUpdate
> {
  constructor(client: OmenSupabaseClient) {
    super(client, "outbound_posts");
  }

  async createPost(post: OutboundPost): Promise<Result<OutboundPost, RepositoryError>> {
    const inserted = await this.insertOne(toInsertRow(post));

    if (!inserted.ok) {
      return inserted;
    }

    return ok(toOutboundPost(inserted.value));
  }

  async updatePost(
    postId: string,
    patch: Partial<OutboundPost>,
  ): Promise<Result<OutboundPost, RepositoryError>> {
    const updated = await this.updateById(postId, withoutUndefined(toUpdateRow(patch)));

    if (!updated.ok) {
      return updated;
    }

    return ok(toOutboundPost(updated.value));
  }

  async listRecentPosts(limit = 20): Promise<Result<OutboundPost[], RepositoryError>> {
    const listed = await this.list({
      limit,
      orderBy: "updated_at",
      ascending: false,
    });

    if (!listed.ok) {
      return listed;
    }

    return ok(listed.value.map((row) => toOutboundPost(row)));
  }

  async listByRunId(
    runId: string,
    limit = 20,
  ): Promise<Result<OutboundPost[], RepositoryError>> {
    const { data, error } = await this.table()
      .select("*")
      .eq("run_id", runId)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<OutboundPostRow[]>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok((data ?? []).map((row) => toOutboundPost(row)));
  }

  async listByStatus(
    status: OutboundPost["status"],
    limit = 50,
  ): Promise<Result<OutboundPost[], RepositoryError>> {
    const { data, error } = await this.table()
      .select("*")
      .eq("status", status)
      .order("updated_at", { ascending: false })
      .limit(limit)
      .returns<OutboundPostRow[]>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok((data ?? []).map((row) => toOutboundPost(row)));
  }

  async findPostById(
    postId: string,
  ): Promise<Result<OutboundPost | null, RepositoryError>> {
    const found = await this.findById(postId);

    if (!found.ok) {
      return found;
    }

    return ok(found.value ? toOutboundPost(found.value) : null);
  }

  async claimNextReadyPost(): Promise<Result<OutboundPost | null, RepositoryError>> {
    const { data, error } = await this.table()
      .select("*")
      .in("status", ["queued", "ready"] satisfies PostStatus[])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<OutboundPostRow>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    if (!data) {
      return ok(null);
    }

    return this.updatePost(data.id, {
      status: "posting",
      updatedAt: new Date().toISOString(),
    });
  }

  async listByLinkedRecord(input: {
    runId?: string;
    signalId?: string;
    intelId?: string;
    limit?: number;
  }): Promise<Result<OutboundPost[], RepositoryError>> {
    let query = this.table()
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(input.limit ?? 50);

    if (input.runId) {
      query = query.eq("run_id", input.runId);
    }

    if (input.signalId) {
      query = query.eq("signal_id", input.signalId);
    }

    if (input.intelId) {
      query = query.eq("intel_id", input.intelId);
    }

    const { data, error } = await query.returns<OutboundPostRow[]>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok((data ?? []).map((row) => toOutboundPost(row)));
  }

  async findLatestByLinkedRecord(input: {
    signalId?: string;
    intelId?: string;
  }): Promise<Result<OutboundPost | null, RepositoryError>> {
    const query = this.table()
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (input.signalId) {
      query.eq("signal_id", input.signalId);
    }

    if (input.intelId) {
      query.eq("intel_id", input.intelId);
    }

    const { data, error } = await query.maybeSingle<OutboundPostRow>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok(data ? toOutboundPost(data) : null);
  }
}
