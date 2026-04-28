import type { OutboundPost } from "@omen/shared";
import type { OutboundPostsRepository } from "@omen/db";

import { transitionPost } from "./post-state-machine.js";
import type { PostWorker, PostWorkerResult } from "./post-worker.js";

export class OutboundPostQueue {
  constructor(
    private readonly input: {
      posts: OutboundPostsRepository;
      worker: PostWorker;
    },
  ) {}

  async enqueue(post: OutboundPost) {
    return this.input.posts.createPost(post);
  }

  async processOne(): Promise<PostWorkerResult | null> {
    const claimed = await this.input.posts.claimNextReadyPost();

    if (!claimed.ok) {
      throw new Error(`Failed to claim outbound post: ${claimed.error.message}`);
    }

    if (!claimed.value) {
      return null;
    }

    return this.input.worker.process(claimed.value);
  }

  async requeueRetryableFailures(now = new Date()) {
    const failed = await this.input.posts.listByStatus("failed", 50);

    if (!failed.ok) {
      throw new Error(`Failed to load failed outbound posts: ${failed.error.message}`);
    }

    const requeued: OutboundPost[] = [];

    for (const post of failed.value) {
      const retryable = post.payload.metadata.retryable;
      const nextRetryAt = post.payload.metadata.nextRetryAt;

      if (
        retryable !== true ||
        typeof nextRetryAt !== "string" ||
        Date.parse(nextRetryAt) > now.getTime()
      ) {
        continue;
      }

      const updated = await this.input.posts.updatePost(
        post.id,
        transitionPost(post, "retry", {
          lastError: post.lastError,
          updatedAt: now.toISOString(),
        }),
      );

      if (!updated.ok) {
        throw new Error(`Failed to requeue outbound post: ${updated.error.message}`);
      }

      requeued.push(updated.value);
    }

    return requeued;
  }
}
