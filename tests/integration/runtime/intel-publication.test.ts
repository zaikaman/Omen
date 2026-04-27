import { describe, expect, it } from "vitest";

import {
  formatIntelPost,
  formatIntelPostPayload,
} from "../../../backend/src/services/x/post-formatter";
import { transitionPost } from "../../../backend/src/services/x/post-state-machine";
import { PostWorker } from "../../../backend/src/services/x/post-worker";
import { demoIntelRunBundle } from "../../../packages/db/src/index";
import { outboundPostSchema, zeroGRunManifestSchema } from "../../../packages/shared/src/index";
import { RunManifestBuilder } from "../../../packages/zero-g/src/proofs/run-manifest-builder";

describe("intel publication", () => {
  it("creates a single outbound intel post with proof refs", () => {
    const { run, intel, outboundPosts, proofs } = demoIntelRunBundle;

    expect(intel).not.toBeNull();
    if (!intel) {
      throw new Error("Expected the deterministic run to produce intel.");
    }

    const post = outboundPosts.find((candidate) => candidate.intelId === intel.id);

    expect(post).toBeDefined();
    if (!post) {
      throw new Error("Expected the completed intel to create an outbound post.");
    }

    expect(outboundPostSchema.parse(post)).toMatchObject({
      runId: run.id,
      signalId: null,
      intelId: intel.id,
      kind: "intel_summary",
      status: "posted",
      provider: "twitterapi",
      providerPostId: "tweet-intel-001",
      publishedUrl: "https://x.com/omen/status/1000000000000000002",
      lastError: null,
    });
    expect(post.payload.text).toContain("ai infrastructure");
    expect(post.payload.thread).toHaveLength(0);

    const manifest = new RunManifestBuilder().build({
      environment: "test",
      run,
      artifacts: proofs.filter((artifact) => artifact.refType !== "manifest"),
      manifestArtifact: proofs.find((artifact) => artifact.refType === "manifest"),
      createdAt: run.completedAt ?? run.updatedAt,
    });

    expect(zeroGRunManifestSchema.parse(manifest).publicPosts).toHaveLength(1);
    expect(manifest.publicPosts[0]?.artifact.refType).toBe("post_result");
  });

  it("formats intel summaries as a single X post inside limits", () => {
    const { intel } = demoIntelRunBundle;

    expect(intel).not.toBeNull();
    if (!intel) {
      throw new Error("Expected the deterministic run to produce intel.");
    }

    const draft = formatIntelPost(intel);
    const payload = formatIntelPostPayload(intel);

    expect(draft.text.length).toBeLessThanOrEqual(280);
    expect(payload.text.length).toBeLessThanOrEqual(280);
    expect(payload.thread).toHaveLength(0);
    expect(payload.text).toContain("omen intel:");
    expect(payload.text).toContain("- watch:");
  });

  it("supports provider failure fallback metadata and retry transitions", () => {
    const { outboundPosts } = demoIntelRunBundle;
    const posted = outboundPosts[0];

    if (!posted) {
      throw new Error("Expected a seeded outbound post.");
    }

    const posting = { ...posted, status: "posting" as const };
    const failed = transitionPost(posting, "fail", {
      lastError: "twitterapi returned HTTP 500.",
      payload: {
        ...posting.payload,
        metadata: {
          ...posting.payload.metadata,
          attemptCount: 1,
          retryable: true,
          nextRetryAt: "2026-04-25T09:05:20.000Z",
        },
      },
    });
    const retried = transitionPost(failed, "retry");

    expect(failed).toMatchObject({
      status: "failed",
      lastError: "twitterapi returned HTTP 500.",
      payload: {
        metadata: {
          attemptCount: 1,
          retryable: true,
          nextRetryAt: "2026-04-25T09:05:20.000Z",
        },
      },
    });
    expect(retried.status).toBe("queued");
  });

  it("posts one tweet even when a legacy payload still has thread parts", async () => {
    const { outboundPosts } = demoIntelRunBundle;
    const basePost = outboundPosts[0];

    if (!basePost) {
      throw new Error("Expected a seeded outbound post.");
    }

    const post = outboundPostSchema.parse({
      ...basePost,
      status: "ready",
      providerPostId: null,
      publishedUrl: null,
      publishedAt: null,
      payload: {
        ...basePost.payload,
        thread: ["reply one", "reply two", "reply three"],
      },
    });
    const createTweetCalls: unknown[] = [];
    const updates: (typeof post)[] = [];
    const worker = new PostWorker({
      posts: {
        updatePost: async (_id: string, patch: Partial<typeof post>) => {
          const updated = outboundPostSchema.parse({
            ...(updates.at(-1) ?? post),
            ...patch,
          });
          updates.push(updated);
          return { ok: true as const, value: updated };
        },
      } as never,
      twitterApiClient: {
        createTweet: async (draft: unknown) => {
          createTweetCalls.push(draft);
          return { status: "success", tweet_id: "tweet-single-001" };
        },
      } as never,
      logger: {
        warn: () => undefined,
        error: () => undefined,
      } as never,
    });

    const result = await worker.process(post);

    expect(createTweetCalls).toHaveLength(1);
    expect(result.post.providerPostId).toBe("tweet-single-001");
    expect(result.post.payload.metadata).toMatchObject({
      threadCount: 0,
      ignoredThreadCount: 3,
    });
  });
});
