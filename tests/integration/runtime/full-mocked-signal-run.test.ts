import { describe, expect, it } from "vitest";

import { demoSignalRunBundle } from "../../../packages/db/src/index.ts";

describe("full mocked signal run", () => {
  it("produces a completed scheduler-driven signal run with aligned final records", () => {
    const { run, signal, intel, proofBundle, outboundPosts } = demoSignalRunBundle;

    expect(run.triggeredBy).toBe("scheduler");
    expect(run.status).toBe("completed");
    expect(run.outcome?.outcomeType).toBe("signal");
    expect(run.finalSignalId).toBe(signal?.id ?? null);
    expect(run.finalIntelId).toBeNull();
    expect(intel).toBeNull();

    expect(signal).not.toBeNull();
    expect(signal?.runId).toBe(run.id);
    expect(signal?.criticDecision).toBe("approved");
    expect(signal?.reportStatus).toBe("published");
    expect(signal?.finalReportRefId).toBe(proofBundle.manifestRefId);

    expect(outboundPosts).toHaveLength(1);
    expect(outboundPosts[0]).toMatchObject({
      runId: run.id,
      signalId: signal?.id,
      intelId: null,
      target: "x",
      kind: "signal_alert",
      status: "posted",
      provider: "twitterapi",
    });
  });

  it("records the expected AXL, 0G, and publisher artifacts for the deterministic signal path", () => {
    const { nodes, axlMessages, events, proofs, proofBundle, outboundPosts, signal } =
      demoSignalRunBundle;

    const participatingRoles = new Set(
      nodes
        .filter((node) =>
          ["scanner", "research", "analyst", "critic"].includes(node.role),
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
    expect(axlMessages.every((message) => message.runId === signal?.runId)).toBe(true);

    const proofTypes = new Set(proofs.map((proof) => proof.refType));
    expect(proofTypes).toEqual(
      new Set([
        "kv_state",
        "log_bundle",
        "compute_result",
        "manifest",
        "post_result",
      ]),
    );

    expect(
      proofs.find((proof) => proof.id === proofBundle.manifestRefId)?.refType,
    ).toBe("manifest");
    expect(proofBundle.artifactRefs.map((artifact) => artifact.id)).toEqual(
      proofs.map((artifact) => artifact.id),
    );

    const computeProof = proofs.find((proof) => proof.refType === "compute_result");
    expect(computeProof?.compute).toMatchObject({
      provider: "0g-compute",
      model: "glm-5",
      verificationMode: "tee",
    });

    const publishedEvent = events.find(
      (event) => event.eventType === "report_published",
    );
    expect(publishedEvent).toMatchObject({
      agentRole: "publisher",
      proofRefId: "proof-signal-post-001",
      signalId: signal?.id,
    });

    expect(outboundPosts[0]?.payload.metadata).toMatchObject({
      manifestRefId: proofBundle.manifestRefId,
    });
  });
});
