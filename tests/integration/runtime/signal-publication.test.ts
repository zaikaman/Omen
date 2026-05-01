import { describe, expect, it } from "vitest";

import { formatSignalPost } from "../../../backend/src/services/x/post-formatter";
import { demoSignalRunBundle } from "../../fixtures/demo-runtime";
import { outboundPostSchema } from "../../../packages/shared/src/index";

describe("signal publication", () => {
  it("links completed signal runs to a completed outbound X post", () => {
    const { run, signal, events, proofs, proofBundle, outboundPosts } =
      demoSignalRunBundle;

    expect(run).toMatchObject({
      status: "completed",
      finalSignalId: signal?.id,
      finalIntelId: null,
      outcome: {
        outcomeType: "signal",
        signalId: signal?.id,
        intelId: null,
      },
    });

    expect(signal).not.toBeNull();
    if (!signal) {
      throw new Error("Expected the deterministic run to produce a signal.");
    }

    expect(signal).toMatchObject({
      runId: run.id,
      criticDecision: "approved",
      reportStatus: "published",
      finalReportRefId: proofBundle.manifestRefId,
    });
    expect(signal.publishedAt).not.toBeNull();
    expect(Date.parse(signal.publishedAt ?? "")).toBeGreaterThan(
      Date.parse(run.completedAt ?? ""),
    );

    const post = outboundPosts.find((candidate) => candidate.signalId === signal.id);

    expect(post).toBeDefined();
    if (!post) {
      throw new Error("Expected the completed signal to create an outbound post.");
    }

    expect(outboundPostSchema.parse(post)).toMatchObject({
      runId: run.id,
      signalId: signal.id,
      intelId: null,
      target: "x",
      kind: "signal_alert",
      status: "posted",
      provider: "twitterapi",
      providerPostId: "tweet-signal-001",
      publishedUrl: "https://x.com/omen/status/1000000000000000001",
      lastError: null,
      publishedAt: signal.publishedAt,
    });

    expect(post.payload.text).toContain("BTC LONG");
    expect(post.payload.thread).toEqual([]);
    expect(post.payload.metadata).toMatchObject({
      manifestRefId: proofBundle.manifestRefId,
    });
    expect(Date.parse(post.createdAt)).toBeLessThan(
      Date.parse(post.publishedAt ?? ""),
    );
    expect(post.updatedAt).toBe(post.publishedAt);

    const postProof = proofs.find((proof) => proof.refType === "post_result");
    expect(postProof).toMatchObject({
      id: "proof-signal-post-001",
      runId: run.id,
      signalId: signal.id,
      intelId: null,
      metadata: { provider: "twitterapi" },
    });
    expect(proofBundle.artifactRefs).toContainEqual(postProof);
    expect(signal.proofRefIds).toContain(postProof?.id);

    const publishedEvent = events.find(
      (event) => event.eventType === "report_published",
    );
    expect(publishedEvent).toMatchObject({
      runId: run.id,
      agentRole: "publisher",
      status: "success",
      proofRefId: postProof?.id,
      signalId: signal.id,
      intelId: null,
      payload: { provider: "twitterapi" },
      timestamp: post.publishedAt,
    });
  });

  it("formats the approved signal into a valid provider draft before posting", () => {
    const { signal } = demoSignalRunBundle;

    expect(signal).not.toBeNull();
    if (!signal) {
      throw new Error("Expected the deterministic run to produce a signal.");
    }

    const draft = formatSignalPost({
      asset: signal.asset,
      direction: signal.direction,
      confidence: signal.confidence,
      whyNow: signal.whyNow,
      riskReward: signal.riskReward,
      confluences: signal.confluences,
      tradingStyle: signal.tradingStyle,
      expectedDuration: signal.expectedDuration,
      entryPrice: signal.entryPrice,
      targetPrice: signal.targetPrice,
      stopLoss: signal.stopLoss,
      orderType: signal.orderType,
    });

    expect(draft.text.length).toBeLessThanOrEqual(280);
    expect(draft.text).toContain("$BTC");
    expect(draft.text).toContain("conf: 91%");
    expect(draft.replyToTweetId).toBeNull();
    expect(draft.mediaIds).toEqual([]);
  });
});
