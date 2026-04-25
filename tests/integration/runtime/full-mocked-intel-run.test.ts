import { describe, expect, it } from "vitest";

import { demoIntelRunBundle } from "../../../packages/db/src/index.ts";

describe("full mocked intel run", () => {
  it("produces a completed scheduler-driven intel run with aligned final records", () => {
    const { run, signal, intel, proofBundle, outboundPosts } = demoIntelRunBundle;

    expect(run.triggeredBy).toBe("scheduler");
    expect(run.status).toBe("completed");
    expect(run.outcome?.outcomeType).toBe("intel");
    expect(run.finalSignalId).toBeNull();
    expect(run.finalIntelId).toBe(intel?.id ?? null);
    expect(signal).toBeNull();

    expect(intel).not.toBeNull();
    expect(intel?.runId).toBe(run.id);
    expect(intel?.status).toBe("published");
    expect(intel?.proofRefIds).toContain(proofBundle.manifestRefId ?? "");

    expect(outboundPosts).toHaveLength(1);
    expect(outboundPosts[0]).toMatchObject({
      runId: run.id,
      signalId: null,
      intelId: intel?.id,
      target: "x",
      kind: "intel_summary",
      status: "posted",
      provider: "twitterapi",
    });
  });

  it("records the expected AXL, 0G, and publisher artifacts for the deterministic intel path", () => {
    const { nodes, axlMessages, events, proofs, proofBundle, outboundPosts, intel } =
      demoIntelRunBundle;

    const participatingRoles = new Set(
      nodes
        .filter((node) =>
          ["research", "analyst", "publisher", "orchestrator"].includes(node.role),
        )
        .map((node) => node.role),
    );
    expect(participatingRoles.size).toBeGreaterThanOrEqual(4);

    expect(axlMessages).toHaveLength(3);
    expect(axlMessages.map((message) => message.transportKind)).toEqual([
      "mcp",
      "a2a",
      "send",
    ]);
    expect(axlMessages.every((message) => message.runId === intel?.runId)).toBe(true);

    const proofTypes = new Set(proofs.map((proof) => proof.refType));
    expect(proofTypes).toEqual(
      new Set(["kv_state", "log_bundle", "manifest", "post_result"]),
    );
    expect(proofs.every((proof) => proof.intelId === intel?.id)).toBe(true);

    expect(
      proofs.find((proof) => proof.id === proofBundle.manifestRefId)?.refType,
    ).toBe("manifest");
    expect(proofBundle.artifactRefs.map((artifact) => artifact.id)).toEqual(
      proofs.map((artifact) => artifact.id),
    );

    const intelReadyEvent = events.find((event) => event.eventType === "intel_ready");
    expect(intelReadyEvent).toMatchObject({
      agentRole: "analyst",
      intelId: intel?.id,
      proofRefId: "proof-intel-kv-001",
    });

    const publishedEvent = events.find(
      (event) => event.eventType === "report_published",
    );
    expect(publishedEvent).toMatchObject({
      agentRole: "publisher",
      proofRefId: "proof-intel-post-001",
      intelId: intel?.id,
    });

    expect(outboundPosts[0]?.payload.metadata).toMatchObject({
      manifestRefId: proofBundle.manifestRefId,
    });
    expect(outboundPosts[0]?.payload.thread).toHaveLength(1);
  });
});
