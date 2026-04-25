import {
  agentNodeSchema,
  err,
  ok,
  type AgentNode,
  type Result,
} from "@omen/shared";

import {
  BaseRepository,
  type RepositoryError,
} from "./base-repository.js";
import type { OmenSupabaseClient } from "../client/supabase.js";

type AgentNodeRow = {
  id: string;
  role: AgentNode["role"];
  transport: AgentNode["transport"];
  status: AgentNode["status"];
  peer_id: string | null;
  last_heartbeat_at: string | null;
  last_error: string | null;
  metadata: Record<string, unknown>;
};

type AgentNodeInsert = {
  id?: string;
  role: AgentNode["role"];
  transport: AgentNode["transport"];
  status: AgentNode["status"];
  peer_id?: string | null;
  last_heartbeat_at?: string | null;
  last_error?: string | null;
  metadata: Record<string, unknown>;
};

type AgentNodeUpdate = Partial<AgentNodeInsert>;

const toAgentNode = (row: AgentNodeRow): AgentNode =>
  agentNodeSchema.parse({
    id: row.id,
    role: row.role,
    transport: row.transport,
    status: row.status,
    peerId: row.peer_id,
    lastHeartbeatAt: row.last_heartbeat_at,
    lastError: row.last_error,
    metadata: row.metadata,
  });

const toInsertRow = (node: AgentNode): AgentNodeInsert => ({
  id: node.id,
  role: node.role,
  transport: node.transport,
  status: node.status,
  peer_id: node.peerId,
  last_heartbeat_at: node.lastHeartbeatAt,
  last_error: node.lastError,
  metadata: node.metadata,
});

export class AgentNodesRepository extends BaseRepository<
  AgentNodeRow,
  AgentNodeInsert,
  AgentNodeUpdate
> {
  constructor(client: OmenSupabaseClient) {
    super(client, "agent_nodes");
  }

  async upsertNode(node: AgentNode): Promise<Result<AgentNode, RepositoryError>> {
    const saved = await this.upsertOne(toInsertRow(node), {
      onConflict: "id",
    });

    if (!saved.ok) {
      return saved;
    }

    return ok(toAgentNode(saved.value));
  }

  async listNodes(limit = 50): Promise<Result<AgentNode[], RepositoryError>> {
    const listed = await this.list({
      limit,
      orderBy: "updated_at",
      ascending: false,
    });

    if (!listed.ok) {
      return listed;
    }

    return ok(listed.value.map((row) => toAgentNode(row)));
  }

  async listByStatus(
    status: AgentNode["status"],
  ): Promise<Result<AgentNode[], RepositoryError>> {
    const { data, error } = await this.table()
      .select("*")
      .eq("status", status)
      .order("updated_at", { ascending: false })
      .returns<AgentNodeRow[]>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok((data ?? []).map((row) => toAgentNode(row)));
  }

  async findByPeerId(
    peerId: string,
  ): Promise<Result<AgentNode | null, RepositoryError>> {
    const { data, error } = await this.table()
      .select("*")
      .eq("peer_id", peerId)
      .limit(1)
      .maybeSingle<AgentNodeRow>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok(data ? toAgentNode(data) : null);
  }

  async updateHeartbeat(input: {
    id: string;
    lastHeartbeatAt: string;
    status?: AgentNode["status"];
    lastError?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<Result<AgentNode, RepositoryError>> {
    const updated = await this.updateById(input.id, {
      last_heartbeat_at: input.lastHeartbeatAt,
      status: input.status,
      last_error: input.lastError,
      metadata: input.metadata,
    });

    if (!updated.ok) {
      return updated;
    }

    return ok(toAgentNode(updated.value));
  }
}
