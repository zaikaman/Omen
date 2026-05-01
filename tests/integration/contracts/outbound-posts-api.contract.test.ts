import { describe, expect, it } from "vitest";

import {
  dashboardSummarySchema,
  postFeedResponseSchema,
  postStatusResponseSchema,
} from "../../../packages/shared/src/index";
import { demoDashboardSummary, demoRunBundles } from "../../fixtures/demo-runtime";

const demoOutboundPosts = demoRunBundles.flatMap((bundle) => bundle.outboundPosts);

describe("outbound posts api contract", () => {
  it("accepts the outbound post feed response contract for GET /api/posts", () => {
    const response = {
      success: true,
      data: {
        items: demoOutboundPosts,
      },
    };

    expect(response.success).toBe(true);
    expect(postFeedResponseSchema.parse(response.data)).toMatchObject({
      items: [
        {
          id: "post-signal-001",
          runId: "run-signal-001",
          signalId: "signal-btc-long-001",
          intelId: null,
          target: "x",
          kind: "signal_alert",
          status: "posted",
          provider: "twitterapi",
          providerPostId: "tweet-signal-001",
          publishedUrl: "https://x.com/omen/status/1000000000000000001",
          lastError: null,
        },
        {
          id: "post-intel-001",
          runId: "run-intel-001",
          signalId: null,
          intelId: "intel-ai-rotation-001",
          target: "x",
          kind: "intel_summary",
          status: "posted",
          provider: "twitterapi",
          providerPostId: "tweet-intel-001",
          publishedUrl: "https://x.com/omen/status/1000000000000000002",
          lastError: null,
        },
      ],
    });
  });

  it("accepts the outbound post status response contract for GET /api/posts/:id", () => {
    const post = demoOutboundPosts.find((item) => item.id === "post-intel-001");
    const response = {
      success: true,
      data: {
        item: post,
      },
    };

    expect(response.success).toBe(true);
    expect(post).toBeDefined();
    expect(postStatusResponseSchema.parse(response.data)).toMatchObject({
      item: {
        id: "post-intel-001",
        runId: "run-intel-001",
        signalId: null,
        intelId: "intel-ai-rotation-001",
        target: "x",
        kind: "intel_summary",
        status: "posted",
        payload: {
          text: expect.stringContaining("Omen intel"),
          thread: [],
          metadata: {
            manifestRefId: "proof-intel-manifest-001",
          },
        },
        provider: "twitterapi",
        providerPostId: "tweet-intel-001",
        publishedUrl: "https://x.com/omen/status/1000000000000000002",
        lastError: null,
        publishedAt: "2026-04-25T09:04:20.000Z",
      },
    });
  });

  it("accepts queued and failed outbound post status variants", () => {
    const queuedPost = {
      ...demoOutboundPosts[0],
      id: "post-signal-queued-001",
      status: "queued",
      providerPostId: null,
      publishedUrl: null,
      publishedAt: null,
      lastError: null,
    };
    const failedPost = {
      ...demoOutboundPosts[1],
      id: "post-intel-failed-001",
      status: "failed",
      providerPostId: null,
      publishedUrl: null,
      publishedAt: null,
      lastError: "twitterapi rate limit exceeded",
    };

    expect(postStatusResponseSchema.parse({ item: queuedPost })).toMatchObject({
      item: {
        id: "post-signal-queued-001",
        status: "queued",
        providerPostId: null,
        publishedUrl: null,
        lastError: null,
      },
    });
    expect(postStatusResponseSchema.parse({ item: failedPost })).toMatchObject({
      item: {
        id: "post-intel-failed-001",
        status: "failed",
        providerPostId: null,
        publishedUrl: null,
        lastError: "twitterapi rate limit exceeded",
      },
    });
  });

  it("accepts dashboard posting fields in GET /api/dashboard/summary", () => {
    const response = {
      success: true,
      data: demoDashboardSummary,
    };

    expect(response.success).toBe(true);
    expect(dashboardSummarySchema.parse(response.data)).toMatchObject({
      latestPost: {
        id: "post-intel-001",
        runId: "run-intel-001",
        signalId: null,
        intelId: "intel-ai-rotation-001",
        target: "x",
        kind: "intel_summary",
        status: "posted",
        provider: "twitterapi",
        providerPostId: "tweet-intel-001",
        publishedUrl: "https://x.com/omen/status/1000000000000000002",
        lastError: null,
        payload: {
          text: expect.stringContaining("Omen intel"),
          thread: [],
          metadata: {
            manifestRefId: "proof-intel-manifest-001",
          },
        },
      },
    });
  });
});
