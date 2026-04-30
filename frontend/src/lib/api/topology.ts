import {
  agentNodeSchema,
  axlDeliveryStatusSchema,
  axlMcpServiceContractSchema,
  axlPeerStatusSchema,
  type AgentNode,
  type AgentRole,
  type AxlPeerStatus,
} from '@omen/shared';

import { apiRequest } from './client';

export type RegisteredServiceStatus = 'online' | 'degraded' | 'offline';

export type RegisteredAxlService = {
  registrationId: string;
  service: string;
  version: string;
  peerId: string | null;
  role: AgentRole;
  description: string;
  methods: string[];
  tags: string[];
  status: RegisteredServiceStatus;
  registeredAt: string;
  lastSeenAt: string;
};

export type AxlRouteKind = 'send' | 'mcp' | 'a2a';
export type AxlRouteDeliveryStatus = 'queued' | 'sent' | 'delivered' | 'failed';

export type AxlRouteRecord = {
  kind: AxlRouteKind;
  peerId: string;
  sourcePeerId: string | null;
  destinationPeerId: string | null;
  role: string | null;
  service: string | null;
  method: string | null;
  operation: string;
  runId: string | null;
  correlationId: string | null;
  delegationId: string | null;
  routeChainId: string | null;
  deliveryStatus: AxlRouteDeliveryStatus;
  observedAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  topologyPeerIds: string[];
  outputRefs: Array<{ kind: 'signal' | 'intel'; id: string }>;
  metadata: Record<string, unknown>;
};

export type TopologySnapshot = {
  capturedAt: string;
  source: string;
  peers: AxlPeerStatus[];
  services: RegisteredAxlService[];
  routes: AxlRouteRecord[];
  metadata: Record<string, unknown>;
};

export type TopologyResponse = {
  nodes: AgentNode[];
  snapshot: TopologySnapshot;
};

const registeredServiceStatusValues = ['online', 'degraded', 'offline'] as const;
const axlRouteKindValues = ['send', 'mcp', 'a2a'] as const;

const isRegisteredServiceStatus = (
  value: unknown,
): value is RegisteredServiceStatus =>
  registeredServiceStatusValues.includes(value as RegisteredServiceStatus);

const isAxlRouteKind = (value: unknown): value is AxlRouteKind =>
  axlRouteKindValues.includes(value as AxlRouteKind);

const parseRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const parseRouteDeliveryStatus = (value: unknown): AxlRouteDeliveryStatus => {
  const parsed = axlDeliveryStatusSchema.parse(value);

  return parsed === 'received' ? 'delivered' : parsed;
};

const registeredAxlServiceSchema = {
  parse: (input: unknown): RegisteredAxlService => {
    const payload = parseRecord(input);
    const contract = axlMcpServiceContractSchema.parse(payload);

    if (typeof payload.registrationId !== 'string') {
      throw new Error('Invalid AXL service registration id.');
    }

    if (!isRegisteredServiceStatus(payload.status)) {
      throw new Error('Invalid AXL service status.');
    }

    if (typeof payload.registeredAt !== 'string') {
      throw new Error('Invalid AXL service registration timestamp.');
    }

    if (typeof payload.lastSeenAt !== 'string') {
      throw new Error('Invalid AXL service last-seen timestamp.');
    }

    return {
      ...contract,
      registrationId: payload.registrationId,
      status: payload.status,
      registeredAt: payload.registeredAt,
      lastSeenAt: payload.lastSeenAt,
    };
  },
};

const axlRouteRecordSchema = {
  parse: (input: unknown): AxlRouteRecord => {
    const payload = parseRecord(input);

    if (!isAxlRouteKind(payload.kind)) {
      throw new Error('Invalid AXL route kind.');
    }

    if (typeof payload.peerId !== 'string') {
      throw new Error('Invalid AXL route peer id.');
    }

    if (typeof payload.operation !== 'string') {
      throw new Error('Invalid AXL route operation.');
    }

    return {
      kind: payload.kind,
      peerId: payload.peerId,
      sourcePeerId:
        typeof payload.sourcePeerId === 'string' ? payload.sourcePeerId : null,
      destinationPeerId:
        typeof payload.destinationPeerId === 'string'
          ? payload.destinationPeerId
          : typeof payload.peerId === 'string'
            ? payload.peerId
            : null,
      role: typeof payload.role === 'string' ? payload.role : null,
      service: typeof payload.service === 'string' ? payload.service : null,
      method: typeof payload.method === 'string' ? payload.method : null,
      operation: payload.operation,
      runId: typeof payload.runId === 'string' ? payload.runId : null,
      correlationId:
        typeof payload.correlationId === 'string'
          ? payload.correlationId
          : null,
      delegationId:
        typeof payload.delegationId === 'string' ? payload.delegationId : null,
      routeChainId:
        typeof payload.routeChainId === 'string' ? payload.routeChainId : null,
      deliveryStatus: parseRouteDeliveryStatus(payload.deliveryStatus),
      observedAt:
        typeof payload.observedAt === 'string' ? payload.observedAt : '',
      acceptedAt:
        typeof payload.acceptedAt === 'string' ? payload.acceptedAt : null,
      completedAt:
        typeof payload.completedAt === 'string' ? payload.completedAt : null,
      failedAt: typeof payload.failedAt === 'string' ? payload.failedAt : null,
      topologyPeerIds: Array.isArray(payload.topologyPeerIds)
        ? payload.topologyPeerIds.filter(
            (peerId): peerId is string => typeof peerId === 'string',
          )
        : [],
      outputRefs: Array.isArray(payload.outputRefs)
        ? payload.outputRefs
            .map((ref) => parseRecord(ref))
            .filter(
              (
                ref,
              ): ref is {
                kind: 'signal' | 'intel';
                id: string;
              } =>
                (ref.kind === 'signal' || ref.kind === 'intel') &&
                typeof ref.id === 'string',
            )
        : [],
      metadata: parseRecord(payload.metadata),
    };
  },
};

const topologySnapshotSchema = {
  parse: (input: unknown): TopologySnapshot => {
    const payload = parseRecord(input);

    return {
      capturedAt:
        typeof payload.capturedAt === 'string' ? payload.capturedAt : '',
      source: typeof payload.source === 'string' ? payload.source : 'unknown',
      peers: Array.isArray(payload.peers)
        ? payload.peers.map((peer) => axlPeerStatusSchema.parse(peer))
        : [],
      services: Array.isArray(payload.services)
        ? payload.services.map((service) =>
            registeredAxlServiceSchema.parse(service),
          )
        : [],
      routes: Array.isArray(payload.routes)
        ? payload.routes.map((route) => axlRouteRecordSchema.parse(route))
        : [],
      metadata: parseRecord(payload.metadata),
    };
  },
};

const topologyResponseSchema = {
  parse: (input: unknown): TopologyResponse => {
    const payload = parseRecord(input);

    return {
      nodes: Array.isArray(payload.nodes)
        ? payload.nodes.map((node) => agentNodeSchema.parse(node))
        : [],
      snapshot: topologySnapshotSchema.parse(payload.snapshot),
    };
  },
};

export const getLiveTopology = (): Promise<TopologyResponse> =>
  apiRequest('/topology', topologyResponseSchema);

export const getTopology = getLiveTopology;
