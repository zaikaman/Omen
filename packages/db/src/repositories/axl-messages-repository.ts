import {
  axlEnvelopeSchema,
  err,
  ok,
  type AxlEnvelope,
  type Result,
} from "@omen/shared";

import {
  BaseRepository,
  type RepositoryError,
} from "./base-repository.js";
import type { OmenSupabaseClient } from "../client/supabase.js";

type AxlMessageRow = {
  id: string;
  run_id: string;
  correlation_id: string;
  from_agent_id: string;
  from_role: AxlEnvelope["fromRole"];
  to_agent_id: string | null;
  to_role: AxlEnvelope["toRole"];
  topic: string | null;
  message_type: string;
  payload: Record<string, unknown>;
  transport_kind: AxlEnvelope["transportKind"];
  delivery_status: AxlEnvelope["deliveryStatus"];
  durable_ref_id: string | null;
  timestamp: string;
};

type AxlMessageInsert = {
  id?: string;
  run_id: string;
  correlation_id: string;
  from_agent_id: string;
  from_role: AxlEnvelope["fromRole"];
  to_agent_id?: string | null;
  to_role?: AxlEnvelope["toRole"];
  topic?: string | null;
  message_type: string;
  payload: Record<string, unknown>;
  transport_kind: AxlEnvelope["transportKind"];
  delivery_status: AxlEnvelope["deliveryStatus"];
  durable_ref_id?: string | null;
  timestamp: string;
};

const toAxlEnvelope = (row: AxlMessageRow): AxlEnvelope =>
  axlEnvelopeSchema.parse({
    id: row.id,
    runId: row.run_id,
    correlationId: row.correlation_id,
    fromAgentId: row.from_agent_id,
    fromRole: row.from_role,
    toAgentId: row.to_agent_id,
    toRole: row.to_role,
    topic: row.topic,
    messageType: row.message_type,
    payload: row.payload,
    transportKind: row.transport_kind,
    deliveryStatus: row.delivery_status,
    durableRefId: row.durable_ref_id,
    timestamp: row.timestamp,
  });

const toInsertRow = (message: AxlEnvelope): AxlMessageInsert => ({
  id: message.id,
  run_id: message.runId,
  correlation_id: message.correlationId,
  from_agent_id: message.fromAgentId,
  from_role: message.fromRole,
  to_agent_id: message.toAgentId,
  to_role: message.toRole,
  topic: message.topic,
  message_type: message.messageType,
  payload: message.payload,
  transport_kind: message.transportKind,
  delivery_status: message.deliveryStatus,
  durable_ref_id: message.durableRefId,
  timestamp: message.timestamp,
});

export class AxlMessagesRepository extends BaseRepository<
  AxlMessageRow,
  AxlMessageInsert
> {
  constructor(client: OmenSupabaseClient) {
    super(client, "axl_messages");
  }

  async createMessage(
    message: AxlEnvelope,
  ): Promise<Result<AxlEnvelope, RepositoryError>> {
    const inserted = await this.insertOne(toInsertRow(message));

    if (!inserted.ok) {
      return inserted;
    }

    return ok(toAxlEnvelope(inserted.value));
  }

  async listByRunId(
    runId: string,
    limit = 200,
  ): Promise<Result<AxlEnvelope[], RepositoryError>> {
    const { data, error } = await this.table()
      .select("*")
      .eq("run_id", runId)
      .order("timestamp", { ascending: true })
      .limit(limit)
      .returns<AxlMessageRow[]>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok((data ?? []).map((row) => toAxlEnvelope(row)));
  }

  async listByCorrelationId(
    correlationId: string,
    limit = 100,
  ): Promise<Result<AxlEnvelope[], RepositoryError>> {
    const { data, error } = await this.table()
      .select("*")
      .eq("correlation_id", correlationId)
      .order("timestamp", { ascending: true })
      .limit(limit)
      .returns<AxlMessageRow[]>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok((data ?? []).map((row) => toAxlEnvelope(row)));
  }
}
