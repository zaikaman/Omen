import {
  twitterApiCreateTweetRequestSchema,
  twitterApiCreateTweetResponseSchema,
  twitterApiCredentialsSchema,
  type TwitterApiCreateTweetResponse,
  type XPostDraft,
} from "@omen/shared";

import type { Logger } from "../../bootstrap/logger";
import { RateLimitStore } from "./rate-limit-store";

export class TwitterApiClient {
  private readonly credentials: ReturnType<typeof twitterApiCredentialsSchema.parse>;

  constructor(
    credentials: {
      apiKey: string;
      loginCookies: string;
      proxy: string;
      baseUrl?: string;
    },
    private readonly logger: Logger,
    private readonly rateLimitStore = new RateLimitStore(),
  ) {
    this.credentials = twitterApiCredentialsSchema.parse(credentials);
  }

  async createTweet(draft: XPostDraft): Promise<TwitterApiCreateTweetResponse> {
    const rateLimitState = this.rateLimitStore.get("twitterapi");

    if (rateLimitState.isRateLimited) {
      throw new Error(
        `twitterapi is currently marked rate limited${rateLimitState.resetAt ? ` until ${rateLimitState.resetAt}` : ""}.`,
      );
    }

    const payload = twitterApiCreateTweetRequestSchema.parse({
      login_cookies: this.credentials.loginCookies,
      tweet_text: draft.text,
      proxy: this.credentials.proxy,
      reply_to_tweet_id: draft.replyToTweetId ?? undefined,
      attachment_url: draft.attachmentUrl ?? undefined,
      community_id: draft.communityId ?? undefined,
      is_note_tweet: draft.isNoteTweet || undefined,
      media_ids: draft.mediaIds.length > 0 ? draft.mediaIds : undefined,
      quote_tweet_id: draft.quoteTweetId ?? undefined,
      schedule_for: draft.scheduleFor ?? undefined,
    });

    const response = await fetch(
      new URL("/twitter/create_tweet_v2", this.credentials.baseUrl),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.credentials.apiKey,
        },
        body: JSON.stringify(payload),
      },
    );

    if (response.status === 429) {
      this.rateLimitStore.markRateLimited("twitterapi", {
        error: "HTTP 429 from twitterapi create_tweet_v2",
      });

      throw new Error("twitterapi returned HTTP 429.");
    }

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error("twitterapi create_tweet_v2 failed.", errorText);
      throw new Error(
        `twitterapi create_tweet_v2 failed with HTTP ${response.status.toString()}.`,
      );
    }

    const json = (await response.json()) as unknown;
    const parsed = twitterApiCreateTweetResponseSchema.parse(json);

    if (parsed.status !== "success") {
      throw new Error(parsed.msg ?? "twitterapi returned a non-success status.");
    }

    this.rateLimitStore.clear("twitterapi");

    return parsed;
  }
}
