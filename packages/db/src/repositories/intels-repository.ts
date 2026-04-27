import {
  err,
  intelSchema,
  ok,
  type Intel,
  type Result,
} from "@omen/shared";

import {
  BaseRepository,
  type RepositoryError,
} from "./base-repository.js";
import type { OmenSupabaseClient } from "../client/supabase.js";
import { normalizeDatabaseTimestamp } from "./timestamp.js";

type IntelRow = {
  id: string;
  run_id: string;
  title: string;
  slug: string;
  summary: string;
  body: string;
  category: Intel["category"];
  status: Intel["status"];
  symbols: string[];
  confidence: number;
  sources: Intel["sources"];
  proof_ref_ids: string[];
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type IntelInsert = {
  id?: string;
  run_id: string;
  title: string;
  slug: string;
  summary: string;
  body: string;
  category: Intel["category"];
  status: Intel["status"];
  symbols?: string[];
  confidence: number;
  sources?: Intel["sources"];
  proof_ref_ids?: string[];
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

type IntelUpdate = Partial<IntelInsert>;

const toIntel = (row: IntelRow): Intel =>
  intelSchema.parse({
    id: row.id,
    runId: row.run_id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    body: row.body,
    category: row.category,
    status: row.status,
    symbols: row.symbols,
    confidence: row.confidence,
    sources: row.sources,
    proofRefIds: row.proof_ref_ids,
    publishedAt: normalizeDatabaseTimestamp(row.published_at),
    createdAt: normalizeDatabaseTimestamp(row.created_at),
    updatedAt: normalizeDatabaseTimestamp(row.updated_at),
  });

const toInsertRow = (intel: Intel): IntelInsert => ({
  id: intel.id,
  run_id: intel.runId,
  title: intel.title,
  slug: intel.slug,
  summary: intel.summary,
  body: intel.body,
  category: intel.category,
  status: intel.status,
  symbols: intel.symbols,
  confidence: intel.confidence,
  sources: intel.sources,
  proof_ref_ids: intel.proofRefIds,
  published_at: intel.publishedAt,
  created_at: intel.createdAt,
  updated_at: intel.updatedAt,
});

const toUpdateRow = (patch: Partial<Intel>): IntelUpdate => ({
  run_id: patch.runId,
  title: patch.title,
  slug: patch.slug,
  summary: patch.summary,
  body: patch.body,
  category: patch.category,
  status: patch.status,
  symbols: patch.symbols,
  confidence: patch.confidence,
  sources: patch.sources,
  proof_ref_ids: patch.proofRefIds,
  published_at: patch.publishedAt,
  created_at: patch.createdAt,
  updated_at: patch.updatedAt,
});

export class IntelsRepository extends BaseRepository<IntelRow, IntelInsert, IntelUpdate> {
  constructor(client: OmenSupabaseClient) {
    super(client, "intels");
  }

  async createIntel(intel: Intel): Promise<Result<Intel, RepositoryError>> {
    const inserted = await this.insertOne(toInsertRow(intel));

    if (!inserted.ok) {
      return inserted;
    }

    return ok(toIntel(inserted.value));
  }

  async updateIntel(
    intelId: string,
    patch: Partial<Intel>,
  ): Promise<Result<Intel, RepositoryError>> {
    const updated = await this.updateById(intelId, toUpdateRow(patch));

    if (!updated.ok) {
      return updated;
    }

    return ok(toIntel(updated.value));
  }

  async listRecentIntel(limit = 20): Promise<Result<Intel[], RepositoryError>> {
    const listed = await this.list({
      limit,
      orderBy: "published_at",
      ascending: false,
    });

    if (!listed.ok) {
      return listed;
    }

    return ok(listed.value.map((row) => toIntel(row)));
  }

  async listByRunId(
    runId: string,
    limit = 20,
  ): Promise<Result<Intel[], RepositoryError>> {
    const { data, error } = await this.table()
      .select("*")
      .eq("run_id", runId)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<IntelRow[]>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok((data ?? []).map((row) => toIntel(row)));
  }

  async findBySlug(slug: string): Promise<Result<Intel | null, RepositoryError>> {
    const { data, error } = await this.table()
      .select("*")
      .eq("slug", slug)
      .limit(1)
      .maybeSingle<IntelRow>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok(data ? toIntel(data) : null);
  }

  async findLatestPublished(): Promise<Result<Intel | null, RepositoryError>> {
    const { data, error } = await this.table()
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle<IntelRow>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok(data ? toIntel(data) : null);
  }
}
