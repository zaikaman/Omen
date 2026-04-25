import type { PostgrestError } from "@supabase/supabase-js";

import { err, ok, type Result } from "@omen/shared";
import type { OmenSupabaseClient } from "../client/supabase.js";

export interface RepositoryListOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  ascending?: boolean;
}

export interface RepositoryFindByIdOptions {
  idColumn?: string;
}

export interface RepositoryUpsertOptions {
  onConflict?: string;
  ignoreDuplicates?: boolean;
}

export type RepositoryError = {
  code: string | null;
  details: string | null;
  hint: string | null;
  message: string;
};

const toRepositoryError = (error: PostgrestError): RepositoryError => ({
  code: error.code,
  details: error.details,
  hint: error.hint,
  message: error.message,
});

export abstract class BaseRepository<
  TRow extends Record<string, unknown>,
  TInsert extends Record<string, unknown> = Partial<TRow>,
  TUpdate extends Record<string, unknown> = Partial<TInsert>,
> {
  protected constructor(
    protected readonly client: OmenSupabaseClient,
    protected readonly tableName: string,
  ) {}

  protected table() {
    return this.client.from(this.tableName);
  }

  async findById(
    id: string,
    options: RepositoryFindByIdOptions = {},
  ): Promise<Result<TRow | null, RepositoryError>> {
    const idColumn = options.idColumn ?? "id";

    const { data, error } = await this.table()
      .select("*")
      .eq(idColumn, id)
      .maybeSingle<TRow>();

    if (error) {
      return err(toRepositoryError(error));
    }

    return ok(data ?? null);
  }

  async list(
    options: RepositoryListOptions = {},
  ): Promise<Result<TRow[], RepositoryError>> {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    const orderBy = options.orderBy ?? "created_at";
    const ascending = options.ascending ?? false;

    const query = this.table()
      .select("*")
      .order(orderBy, { ascending })
      .range(offset, offset + limit - 1);

    const { data, error } = await query.returns<TRow[]>();

    if (error) {
      return err(toRepositoryError(error));
    }

    return ok(data ?? []);
  }

  async insertOne(
    input: TInsert,
  ): Promise<Result<TRow, RepositoryError>> {
    const { data, error } = await this.table()
      .insert(input as never)
      .select("*")
      .single<TRow>();

    if (error) {
      return err(toRepositoryError(error));
    }

    return ok(data);
  }

  async updateById(
    id: string,
    input: TUpdate,
    options: RepositoryFindByIdOptions = {},
  ): Promise<Result<TRow, RepositoryError>> {
    const idColumn = options.idColumn ?? "id";

    const { data, error } = await this.table()
      .update(input as never)
      .eq(idColumn, id)
      .select("*")
      .single<TRow>();

    if (error) {
      return err(toRepositoryError(error));
    }

    return ok(data);
  }

  async upsertOne(
    input: TInsert,
    options: RepositoryUpsertOptions = {},
  ): Promise<Result<TRow, RepositoryError>> {
    const { data, error } = await this.table()
      .upsert(input as never, {
        ignoreDuplicates: options.ignoreDuplicates ?? false,
        onConflict: options.onConflict,
      })
      .select("*")
      .single<TRow>();

    if (error) {
      return err(toRepositoryError(error));
    }

    return ok(data);
  }
}
