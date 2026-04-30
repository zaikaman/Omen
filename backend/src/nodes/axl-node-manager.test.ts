import { describe, expect, it } from "vitest";

import type { AxlHttpNodeAdapter } from "@omen/axl";

import { AxlNodeManager } from "./axl-node-manager.js";
import { AxlPeerRegistry } from "./axl-peer-registry.js";

const peerId = (suffix: string) => `${"0".repeat(62)}${suffix}`;

describe("AxlNodeManager", () => {
  it("registers the full Omen swarm topology as logical AXL nodes", () => {
    const registry = new AxlPeerRegistry();
    const manager = new AxlNodeManager({
      adapter: {} as AxlHttpNodeAdapter,
      peerRegistry: registry,
      orchestratorPeerId: peerId("01"),
      peerIdsByRole: {
        orchestrator: peerId("01"),
        market_bias: peerId("02"),
        scanner: peerId("03"),
        research: peerId("04"),
        chart_vision: peerId("05"),
        analyst: peerId("06"),
        critic: peerId("07"),
        intel: peerId("08"),
        generator: peerId("09"),
        writer: peerId("0a"),
        publisher: peerId("0b"),
        memory: peerId("0c"),
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
    expect(nodes.every((node) => /^[0-9a-f]{64}$/i.test(node.peerId ?? ""))).toBe(true);
    expect(registry.listServices()).toHaveLength(12);
  });
});
