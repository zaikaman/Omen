import { describe, expect, it, vi } from "vitest";

import {
  AxlA2AClient,
  AxlHttpAdapter,
  AxlHttpNodeAdapter,
  AxlServiceRegistry,
  assertAxlMcpMethodSupported,
  buildAxlMcpRoute,
  buildDelegationEnvelope,
  createAxlServiceRouteRecord,
  createAxlMcpSuccessResponse,
  createTopologySnapshot,
  createDelegationRequest,
  acceptDelegation,
  resolveDelegation,
  deserializeOmenMessage,
  serializeOmenMessage,
  toAxlPeerStatuses,
} from "../src/index.js";

describe("axl adapter", () => {
  it("serializes and deserializes Omen envelopes", () => {
    const serialized = serializeOmenMessage({
      envelope: {
        id: "msg-1",
        runId: "run-1",
        correlationId: "corr-1",
        fromAgentId: "agent-orchestrator-001",
        fromRole: "orchestrator",
        toAgentId: "agent-scanner-001",
        toRole: "scanner",
        topic: null,
        messageType: "scan.request",
        payload: { symbol: "BTC" },
        transportKind: "mcp",
        deliveryStatus: "received",
        durableRefId: null,
        timestamp: "2026-04-25T08:00:00.000Z",
      },
      body: { prompt: "scan BTC" },
    });

    const parsed = deserializeOmenMessage(serialized);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.envelope.messageType).toBe("scan.request");
      expect(parsed.value.body.prompt).toBe("scan BTC");
    }
  });

  it("maps topology peers into normalized peer statuses", () => {
    const statuses = toAxlPeerStatuses(
      {
        our_public_key: "self",
        peers: [
          { peer_id: "peer-1", connection_state: "connected" },
          { peer_id: "peer-2", connection_state: "degraded" },
          { peer_id: "peer-3", connection_state: "offline" },
        ],
        tree: [],
      },
      "2026-04-25T08:00:00.000Z",
    );

    expect(statuses.map((status) => status.status)).toEqual([
      "online",
      "degraded",
      "offline",
    ]);
  });

  it("delegates MCP requests through the http client", async () => {
    const adapter = new AxlHttpAdapter({
      node: {
        baseUrl: "http://127.0.0.1:9002",
      },
    });

    const callMcp = vi
      .spyOn(adapter.client, "callMcp")
      .mockResolvedValue({
        ok: true,
        value: { jsonrpc: "2.0", result: "ok" },
      });

    const result = await adapter.callMcp({
      peerId: "peer-1",
      service: "scanner",
      request: { jsonrpc: "2.0", method: "tools/list", id: 1 },
    });

    expect(callMcp).toHaveBeenCalledOnce();
    expect(result.ok).toBe(true);
  });

  it("preserves fromPeerId when receiving envelopes through the node adapter", async () => {
    const adapter = new AxlHttpNodeAdapter({
      node: {
        baseUrl: "http://127.0.0.1:9002",
      },
    });
    const recv = vi.spyOn(adapter.client, "recv").mockResolvedValue({
      ok: true,
      value: {
        fromPeerId: "peer-scanner",
        body: new TextEncoder().encode(
          serializeOmenMessage({
            envelope: {
              id: "msg-2",
              runId: "run-1",
              correlationId: "corr-2",
              fromAgentId: "agent-scanner-001",
              fromRole: "scanner",
              toAgentId: "agent-orchestrator-001",
              toRole: "orchestrator",
              topic: null,
              messageType: "scan.result",
              payload: { symbol: "BTC" },
              transportKind: "send",
              deliveryStatus: "received",
              durableRefId: null,
              timestamp: "2026-04-25T08:00:00.000Z",
            },
            body: { candidates: ["BTC"] },
          }),
        ),
      },
    });

    const result = await adapter.receiveEnvelope();

    expect(recv).toHaveBeenCalledOnce();
    expect(result.ok).toBe(true);
    if (result.ok && result.value) {
      expect(result.value.fromPeerId).toBe("peer-scanner");
      expect(result.value.message.envelope.messageType).toBe("scan.result");
    }
  });

  it("validates MCP contracts against supported service methods", () => {
    const contract = {
      service: "scanner",
      version: "0.1.0",
      peerId: "peer-1",
      role: "scanner" as const,
      description: "Scanner service",
      methods: ["scan.run", "scan.health"],
      tools: [],
      tags: ["runtime"],
    };

    expect(() =>
      assertAxlMcpMethodSupported(contract, {
        jsonrpc: "2.0",
        id: "req-1",
        service: "scanner",
        method: "scan.run",
        params: { asset: "BTC" },
        context: {
          runId: "run-1",
          correlationId: "corr-1",
          callerPeerId: "peer-orchestrator",
          callerRole: "orchestrator",
        },
      }),
    ).not.toThrow();

    expect(
      createAxlMcpSuccessResponse({
        id: "req-1",
        result: { accepted: true },
      }),
    ).toMatchObject({
      jsonrpc: "2.0",
      result: { accepted: true },
    });

    expect(
      buildAxlMcpRoute({
        peerId: "peer-1",
        service: "scanner",
        method: "scan.run",
        runId: "run-1",
        correlationId: "corr-1",
        timeoutMs: 10000,
      }),
    ).toMatchObject({
      peerId: "peer-1",
      service: "scanner",
      method: "scan.run",
    });
  });

  it("builds A2A delegation envelopes across request, receipt, and completion", () => {
    const request = createDelegationRequest({
      delegationId: "delegation-1",
      runId: "run-1",
      correlationId: "corr-1",
      fromPeerId: "peer-orchestrator",
      fromRole: "orchestrator",
      toPeerId: "peer-critic",
      requestedRole: "critic",
      taskType: "critic.review",
      requiredServices: ["critic.review"],
      payload: { thesisId: "thesis-1" },
      timeoutMs: 15000,
      routeHints: ["preferred-peer"],
    });
    const receipt = acceptDelegation({
      request,
      assignedPeerId: "peer-critic",
      assignedRole: "critic",
      acceptedAt: "2026-04-25T08:00:01.000Z",
    });
    const result = resolveDelegation({
      request,
      responderPeerId: "peer-critic",
      responderRole: "critic",
      state: "completed",
      output: { decision: "approved" },
      completedAt: "2026-04-25T08:00:05.000Z",
    });

    expect(
      buildDelegationEnvelope({
        request,
        receipt,
        result,
      }),
    ).toMatchObject({
      request: { delegationId: "delegation-1" },
      receipt: { state: "accepted" },
      result: { state: "completed" },
    });
  });

  it("parses A2A delegation envelopes returned by the transport", async () => {
    const transport = {
      callA2A: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          request: {
            delegationId: "delegation-2",
            runId: "run-2",
            correlationId: "corr-2",
            fromPeerId: "peer-orchestrator",
            fromRole: "orchestrator",
            toPeerId: "peer-analyst",
            requestedRole: "analyst",
            taskType: "thesis.generate",
            requiredServices: ["thesis.generate"],
            payload: { thesisId: "draft-1" },
            timeoutMs: 10000,
            routeHints: [],
          },
          receipt: {
            delegationId: "delegation-2",
            state: "accepted",
            assignedPeerId: "peer-analyst",
            assignedRole: "analyst",
            acceptedAt: "2026-04-25T08:00:01.000Z",
          },
          result: {
            delegationId: "delegation-2",
            state: "completed",
            responderPeerId: "peer-analyst",
            responderRole: "analyst",
            output: { thesis: { symbol: "BTC" }, analystNotes: [] },
            error: null,
            completedAt: "2026-04-25T08:00:05.000Z",
          },
        },
      }),
    };
    const client = new AxlA2AClient(transport);

    const result = await client.delegate({
      peerId: "peer-analyst",
      request: {
        delegationId: "delegation-2",
        runId: "run-2",
        correlationId: "corr-2",
        fromPeerId: "peer-orchestrator",
        fromRole: "orchestrator",
        toPeerId: "peer-analyst",
        requestedRole: "analyst",
        taskType: "thesis.generate",
        requiredServices: ["thesis.generate"],
        payload: { thesisId: "draft-1" },
        timeoutMs: 10000,
        routeHints: [],
      },
    });

    expect(transport.callA2A).toHaveBeenCalledOnce();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.result?.responderRole).toBe("analyst");
    }
  });

  it("captures topology and service registry snapshots", () => {
    const registry = new AxlServiceRegistry();

    registry.updatePeerStatus({
      peerId: "peer-scanner",
      role: "scanner",
      status: "online",
      services: ["scanner"],
      lastSeenAt: "2026-04-25T08:00:00.000Z",
      latencyMs: 14,
    });
    registry.registerService({
      contract: {
        service: "scanner",
        version: "0.1.0",
        peerId: "peer-scanner",
        role: "scanner",
        description: "Scanner capability",
        methods: ["scan.run"],
        tools: [],
        tags: ["runtime"],
      },
      observedAt: "2026-04-25T08:00:00.000Z",
    });
    registry.recordRoute(
      createAxlServiceRouteRecord({
        kind: "mcp",
        peerId: "peer-scanner",
        service: "scanner",
        operation: "scan.run",
        runId: "run-1",
        correlationId: "corr-1",
        deliveryStatus: "received",
        observedAt: "2026-04-25T08:00:01.000Z",
        metadata: {},
      }),
    );

    expect(
      registry.createSnapshot({
        capturedAt: "2026-04-25T08:00:02.000Z",
        source: "axl-topology-poller",
      }),
    ).toMatchObject({
      peers: [{ peerId: "peer-scanner" }],
      services: [{ service: "scanner" }],
      routes: [{ operation: "scan.run" }],
    });

    expect(
      createTopologySnapshot({
        capturedAt: "2026-04-25T08:00:02.000Z",
        source: "axl-node",
        topology: {
          our_public_key: "self",
          peers: [{ peer_id: "peer-1", connection_state: "connected" }],
          tree: [],
        },
      }),
    ).toMatchObject({
      peers: [{ peerId: "peer-1", status: "online" }],
    });
  });
});
