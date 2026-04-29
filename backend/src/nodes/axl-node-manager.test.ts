import { describe, expect, it } from "vitest";

import type { AxlHttpNodeAdapter } from "@omen/axl";

import { AxlNodeManager } from "./axl-node-manager.js";
import { AxlPeerRegistry } from "./axl-peer-registry.js";

describe("AxlNodeManager", () => {
  it("registers the full Omen swarm topology as logical AXL nodes", () => {
    const registry = new AxlPeerRegistry();
    const manager = new AxlNodeManager({
      adapter: {} as AxlHttpNodeAdapter,
      peerRegistry: registry,
      orchestratorPeerId: "omen-orchestrator",
      peerIdsByRole: {
        orchestrator: "omen-orchestrator",
        market_bias: "omen-market-bias",
        scanner: "omen-scanner",
        research: "omen-research",
        chart_vision: "omen-chart-vision",
        analyst: "omen-analyst",
        critic: "omen-critic",
        intel: "omen-intel",
        generator: "omen-generator",
        writer: "omen-writer",
        publisher: "omen-publisher",
        memory: "omen-memory",
      },
    });

    const registrations = manager.registerDefaultLogicalNodes("2026-04-29T00:00:00.000Z");
    const nodes = manager.listManagedNodes();

    expect(registrations).toHaveLength(12);
    expect(nodes.map((node) => node.role).sort()).toEqual(
      [
        "analyst",
        "chart_vision",
        "critic",
        "generator",
        "intel",
        "market_bias",
        "memory",
        "orchestrator",
        "publisher",
        "research",
        "scanner",
        "writer",
      ].sort(),
    );
    expect(nodes.every((node) => node.transport === "axl")).toBe(true);
    expect(nodes.every((node) => node.peerId?.startsWith("omen-"))).toBe(true);
    expect(registry.listServices()).toHaveLength(12);
  });
});
