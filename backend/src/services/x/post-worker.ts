import { xPostDraftSchema, type OutboundPost } from "@omen/shared";
import type { OutboundPostsRepository } from "@omen/db";

import type { Logger } from "../../bootstrap/logger.js";
import { transitionPost } from "./post-state-machine.js";
import type { TwitterApiClient } from "./twitterapi-client.js";
import { TwitterApiProviderError } from "./twitterapi-errors.js";

export type PostWorkerResult = {
  post: OutboundPost;
  providerResponse: Record<string, unknown> | null;
};

const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown post worker error.";

const toXUrl = (tweetId: string) => `https://x.com/i/web/status/${tweetId}`;

export const DEFAULT_POST_RETRY_POLICY = {
  maxAttempts: 3,
  baseDelayMs: 60_000,
} as const;

const getAttemptCount = (post: OutboundPost) => {
  const attemptCount = post.payload.metadata.attemptCount;
  return typeof attemptCount === "number" && Number.isInteger(attemptCount) ? attemptCount : 0;
};

export class PostWorker {
  constructor(
    private readonly input: {
      posts: OutboundPostsRepository;
      twitterApiClient: TwitterApiClient;
      logger: Logger;
    },
  ) {}

  async process(post: OutboundPost): Promise<PostWorkerResult> {
    const postingPost = post.status === "posting" ? post : transitionPost(post, "start_posting");

    if (postingPost.status !== post.status) {
      const updated = await this.input.posts.updatePost(postingPost.id, postingPost);

      if (!updated.ok) {
        throw new Error(`Failed to mark post posting: ${updated.error.message}`);
      }
    }

    try {
      const firstResponse = await this.input.twitterApiClient.createTweet(
        xPostDraftSchema.parse({
          text: post.payload.text,
          replyToTweetId: null,
          quoteTweetId: null,
          attachmentUrl: null,
          communityId: null,
          isNoteTweet: false,
          mediaIds: [],
          scheduleFor: null,
        }),
      );

      const timestamp = new Date().toISOString();
      const posted = transitionPost(postingPost, "mark_posted", {
        providerPostId: firstResponse.tweet_id,
        publishedUrl: toXUrl(firstResponse.tweet_id),
        lastError: null,
        publishedAt: timestamp,
        updatedAt: timestamp,
        payload: {
          ...post.payload,
          metadata: {
            ...post.payload.metadata,
            threadCount: 0,
            ignoredThreadCount: post.payload.thread.length,
          },
        },
      });
      const updated = await this.input.posts.updatePost(post.id, posted);

      if (!updated.ok) {
        throw new Error(`Failed to mark post posted: ${updated.error.message}`);
      }

      return {
        post: updated.value,
        providerResponse: firstResponse,
      };
    } catch (error) {
      const timestamp = new Date().toISOString();
      const attemptCount = getAttemptCount(postingPost) + 1;
      const failed = transitionPost(postingPost, "fail", {
        lastError: toErrorMessage(error),
        updatedAt: timestamp,
        payload: {
          ...post.payload,
          metadata: {
            ...post.payload.metadata,
            attemptCount,
            retryable: error instanceof TwitterApiProviderError ? error.retryable : true,
            nextRetryAt:
              attemptCount < DEFAULT_POST_RETRY_POLICY.maxAttempts
                ? new Date(
                    Date.now() + DEFAULT_POST_RETRY_POLICY.baseDelayMs * attemptCount,
                  ).toISOString()
                : null,
          },
        },
      });
      const updated = await this.input.posts.updatePost(post.id, failed);

      if (error instanceof TwitterApiProviderError && error.kind === "rate_limited") {
        this.input.logger.warn(`twitterapi rate limited until ${error.resetAt ?? "unknown"}.`);
      }

      if (!updated.ok) {
        throw new Error(`Failed to mark post failed: ${updated.error.message}`);
      }

      return {
        post: updated.value,
        providerResponse:
          error instanceof TwitterApiProviderError &&
          error.providerResponse &&
          typeof error.providerResponse === "object"
            ? (error.providerResponse as Record<string, unknown>)
            : null,
      };
    }
  }
}
