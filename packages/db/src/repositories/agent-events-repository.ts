import {
  agentEventSchema,
  err,
  ok,
  type AgentEvent,
  type AgentEventType,
  type Result,
} from "@omen/shared";

import {
  BaseRepository,
  type RepositoryError,
} from "./base-repository.js";
import type { OmenSupabaseClient } from "../client/supabase.js";
import { normalizeDatabaseTimestamp } from "./timestamp.js";

type AgentEventRow = {
  id: string;
  run_id: string;
  agent_id: string;
  agent_role: AgentEvent["agentRole"];
  event_type: AgentEvent["eventType"];
  status: AgentEvent["status"];
  summary: string;
  payload: Record<string, unknown>;
  timestamp: string;
  correlation_id: string | null;
  axl_message_id: string | null;
  proof_ref_id: string | null;
  signal_id: string | null;
  intel_id: string | null;
};

type AgentEventInsert = {
  id?: string;
  run_id: string;
  agent_id: string;
  agent_role: AgentEvent["agentRole"];
  event_type: AgentEvent["eventType"];
  status: AgentEvent["status"];
  summary: string;
  payload: Record<string, unknown>;
  timestamp: string;
  correlation_id?: string | null;
  axl_message_id?: string | null;
  proof_ref_id?: string | null;
  signal_id?: string | null;
  intel_id?: string | null;
};

const toAgentEvent = (row: AgentEventRow): AgentEvent =>
  agentEventSchema.parse({
    id: row.id,
    runId: row.run_id,
    agentId: row.agent_id,
    agentRole: row.agent_role,
    eventType: row.event_type,
    status: row.status,
    summary: row.summary,
    payload: row.payload,
    timestamp: normalizeDatabaseTimestamp(row.timestamp),
    correlationId: row.correlation_id,
    axlMessageId: row.axl_message_id,
    proofRefId: row.proof_ref_id,
    signalId: row.signal_id,
    intelId: row.intel_id,
  });

const toInsertRow = (event: AgentEvent): AgentEventInsert => ({
  id: event.id,
  run_id: event.runId,
  agent_id: event.agentId,
  agent_role: event.agentRole,
  event_type: event.eventType,
  status: event.status,
  summary: event.summary,
  payload: event.payload,
  timestamp: event.timestamp,
  correlation_id: event.correlationId,
  axl_message_id: event.axlMessageId,
  proof_ref_id: event.proofRefId,
  signal_id: event.signalId,
  intel_id: event.intelId,
});

export class AgentEventsRepository extends BaseRepository<
  AgentEventRow,
  AgentEventInsert
> {
  constructor(client: OmenSupabaseClient) {
    super(client, "agent_events");
  }

  async createEvent(event: AgentEvent): Promise<Result<AgentEvent, RepositoryError>> {
    const inserted = await this.insertOne(toInsertRow(event));

    if (!inserted.ok) {
      return inserted;
    }

    return ok(toAgentEvent(inserted.value));
  }

  async listByRunId(
    runId: string,
    limit = 200,
  ): Promise<Result<AgentEvent[], RepositoryError>> {
    const { data, error } = await this.table()
      .select("*")
      .eq("run_id", runId)
      .order("timestamp", { ascending: true })
      .limit(limit)
      .returns<AgentEventRow[]>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok((data ?? []).map((row) => toAgentEvent(row)));
  }

  async listByCorrelationId(
    correlationId: string,
    limit = 100,
  ): Promise<Result<AgentEvent[], RepositoryError>> {
    const { data, error } = await this.table()
      .select("*")
      .eq("correlation_id", correlationId)
      .order("timestamp", { ascending: true })
      .limit(limit)
      .returns<AgentEventRow[]>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok((data ?? []).map((row) => toAgentEvent(row)));
  }

  async listRecentByEventType(input: {
    eventType: AgentEventType;
    limit?: number;
  }): Promise<Result<AgentEvent[], RepositoryError>> {
    const { data, error } = await this.table()
      .select("*")
      .eq("event_type", input.eventType)
      .order("timestamp", { ascending: false })
      .limit(input.limit ?? 50)
      .returns<AgentEventRow[]>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok((data ?? []).map((row) => toAgentEvent(row)));
  }
}
