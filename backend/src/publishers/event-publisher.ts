import type { AgentEvent, AgentNode, Result } from "@omen/shared";
import type {
  AgentEventsRepository,
  AgentNodesRepository,
  RepositoryError,
} from "@omen/db";

export class EventPublisher {
  constructor(
    private readonly input: {
      events: AgentEventsRepository;
      nodes: AgentNodesRepository;
    },
  ) {}

  async publishEvent(
    event: AgentEvent,
  ): Promise<Result<AgentEvent, RepositoryError>> {
    return this.input.events.createEvent(event);
  }

  async syncNodeStatus(
    node: AgentNode,
  ): Promise<Result<AgentNode, RepositoryError>> {
    return this.input.nodes.upsertNode(node);
  }

  async publishNodeEvent(input: {
    node: AgentNode;
    event: AgentEvent;
  }): Promise<
    Result<
      {
        node: AgentNode;
        event: AgentEvent;
      },
      RepositoryError
    >
  > {
    const node = await this.syncNodeStatus(input.node);

    if (!node.ok) {
      return node;
    }

    const event = await this.publishEvent(input.event);

    if (!event.ok) {
      return event;
    }

    return {
      ok: true,
      value: {
        node: node.value,
        event: event.value,
      },
    };
  }

  async publishHeartbeat(input: {
    nodeId: string;
    lastHeartbeatAt: string;
    status?: AgentNode["status"];
    lastError?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<Result<AgentNode, RepositoryError>> {
    return this.input.nodes.updateHeartbeat({
      id: input.nodeId,
      lastHeartbeatAt: input.lastHeartbeatAt,
      status: input.status,
      lastError: input.lastError,
      metadata: input.metadata,
    });
  }
}
