import { randomUUID } from "node:crypto";

import { outboundPostSchema, type Intel, type OutboundPost, type Signal } from "@omen/shared";
import type { OutboundPostsRepository } from "@omen/db";

import type { BackendEnv } from "../bootstrap/env.js";
import type { Logger } from "../bootstrap/logger.js";
import { formatIntelPostPayload, formatSignalPostPayload } from "../services/x/post-formatter.js";
import { PostWorker, type PostWorkerResult } from "../services/x/post-worker.js";
import { TwitterApiClient } from "../services/x/twitterapi-client.js";

const hasTwitterApiKeyAndProxy = (env: BackendEnv) =>
  Boolean(env.twitterApi.apiKey && env.twitterApi.proxy);

const canRefreshOutboundPost = (post: OutboundPost) =>
  post.status === "queued" ||
  post.status === "formatting" ||
  post.status === "ready" ||
  post.status === "failed";

export class PostPublisher {
  private readonly worker: PostWorker | null;

  constructor(
    private readonly input: {
      env: BackendEnv;
      posts: OutboundPostsRepository;
      logger: Logger;
      worker?: PostWorker | null;
    },
  ) {
    this.worker =
      input.worker ??
      (hasTwitterApiKeyAndProxy(input.env)
        ? new PostWorker({
            posts: input.posts,
            twitterApiClient: new TwitterApiClient(
              {
                apiKey: input.env.twitterApi.apiKey ?? "",
                baseUrl: input.env.twitterApi.baseUrl,
                loginCookies: input.env.twitterApi.loginCookies,
                proxy: input.env.twitterApi.proxy ?? "",
                userName: input.env.twitterApi.userName,
                email: input.env.twitterApi.email,
                password: input.env.twitterApi.password,
                totpSecret: input.env.twitterApi.totpSecret,
              },
              input.logger,
            ),
            logger: input.logger,
          })
        : null);
  }

  async publishSignal(signal: Signal): Promise<PostWorkerResult> {
    const post = await this.createOrLoadPost(
      outboundPostSchema.parse({
        id: `post-${randomUUID()}`,
        runId: signal.runId,
        signalId: signal.id,
        intelId: null,
        target: "x",
        kind: "signal_alert",
        status: "ready",
        payload: formatSignalPostPayload(signal),
        provider: "twitterapi",
        providerPostId: null,
        publishedUrl: null,
        lastError: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        publishedAt: null,
      }),
    );

    return this.process(post);
  }

  async publishIntel(intel: Intel): Promise<PostWorkerResult> {
    const post = await this.createOrLoadPost(
      outboundPostSchema.parse({
        id: `post-${randomUUID()}`,
        runId: intel.runId,
        signalId: null,
        intelId: intel.id,
        target: "x",
        kind: "intel_summary",
        status: "ready",
        payload: formatIntelPostPayload(intel),
        provider: "twitterapi",
        providerPostId: null,
        publishedUrl: null,
        lastError: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        publishedAt: null,
      }),
    );

    return this.process(post);
  }

  private async createOrLoadPost(post: OutboundPost) {
    const existing = await this.input.posts.findLatestByLinkedRecord({
      signalId: post.signalId ?? undefined,
      intelId: post.intelId ?? undefined,
    });

    if (!existing.ok) {
      throw new Error(`Failed to check outbound post: ${existing.error.message}`);
    }

    if (existing.value) {
      if (canRefreshOutboundPost(existing.value)) {
        const refreshed = await this.input.posts.updatePost(existing.value.id, {
          payload: post.payload,
          kind: post.kind,
          status: "ready",
          lastError: null,
          updatedAt: new Date().toISOString(),
        });

        if (!refreshed.ok) {
          throw new Error(`Failed to refresh outbound post: ${refreshed.error.message}`);
        }

        return refreshed.value;
      }

      return existing.value;
    }

    const created = await this.input.posts.createPost(post);

    if (!created.ok) {
      throw new Error(`Failed to create outbound post: ${created.error.message}`);
    }

    return created.value;
  }

  private async process(post: OutboundPost): Promise<PostWorkerResult> {
    if (!this.worker) {
      const failed = await this.input.posts.updatePost(post.id, {
        status: "failed",
        lastError: "twitterapi API key and proxy are required before posting.",
        updatedAt: new Date().toISOString(),
      });

      if (!failed.ok) {
        throw new Error(`Failed to update outbound post: ${failed.error.message}`);
      }

      return {
        post: failed.value,
        providerResponse: null,
      };
    }

    return this.worker.process(post);
  }
}
