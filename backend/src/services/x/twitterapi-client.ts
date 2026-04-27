import {
  twitterApiCreateTweetRequestSchema,
  twitterApiCreateTweetResponseSchema,
  twitterApiCredentialsSchema,
  type TwitterApiCreateTweetResponse,
  type XPostDraft,
} from "@omen/shared";

import type { Logger } from "../../bootstrap/logger.js";
import { RateLimitStore } from "./rate-limit-store.js";
import {
  normalizeTwitterApiHttpError,
  normalizeTwitterApiSemanticError,
  TwitterApiProviderError,
} from "./twitterapi-errors.js";

export class TwitterApiClient {
  private readonly credentials: ReturnType<typeof twitterApiCredentialsSchema.parse>;

  constructor(
    credentials: {
      apiKey: string;
      loginCookies?: string | null;
      proxy: string;
      baseUrl?: string;
      userName?: string | null;
      email?: string | null;
      password?: string | null;
      totpSecret?: string | null;
    },
    private readonly logger: Logger,
    private readonly rateLimitStore = new RateLimitStore(),
  ) {
    this.credentials = twitterApiCredentialsSchema.parse(credentials);
  }

  private async ensureLoginCookies() {
    if (this.credentials.loginCookies) {
      return this.credentials.loginCookies;
    }

    if (
      !this.credentials.userName ||
      !this.credentials.email ||
      !this.credentials.password
    ) {
      throw new TwitterApiProviderError(
        "twitterapi write credentials are incomplete. Set TWITTERAPI_LOGIN_COOKIES or login username, email, and password.",
        {
          kind: "configuration",
          retryable: false,
        },
      );
    }

    const body = {
      user_name: this.credentials.userName,
      email: this.credentials.email,
      password: this.credentials.password,
      proxy: this.credentials.proxy,
      totp_secret: this.credentials.totpSecret ?? undefined,
    };
    const response = await fetch(
      new URL("/twitter/user_login_v2", this.credentials.baseUrl),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.credentials.apiKey,
        },
        body: JSON.stringify(body),
      },
    );
    const json = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      throw normalizeTwitterApiHttpError({
        statusCode: response.status,
        body: json,
      });
    }

    const loginCookies =
      json && typeof json === "object" && "login_cookies" in json
        ? (json as { login_cookies?: unknown }).login_cookies
        : null;

    if (typeof loginCookies !== "string" || loginCookies.length === 0) {
      throw normalizeTwitterApiSemanticError(json);
    }

    this.credentials.loginCookies = loginCookies;
    return loginCookies;
  }

  async createTweet(draft: XPostDraft): Promise<TwitterApiCreateTweetResponse> {
    const rateLimitState = this.rateLimitStore.get("twitterapi");

    if (rateLimitState.isRateLimited) {
      throw new Error(
        `twitterapi is currently marked rate limited${rateLimitState.resetAt ? ` until ${rateLimitState.resetAt}` : ""}.`,
      );
    }

    const loginCookies = await this.ensureLoginCookies();
    const payload = twitterApiCreateTweetRequestSchema.parse({
      login_cookies: loginCookies,
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
          "x-api-key": this.credentials.apiKey,
        },
        body: JSON.stringify(payload),
      },
    );

    if (response.status === 429) {
      const resetAt = response.headers.get("retry-after")
        ? new Date(
            Date.now() + Number(response.headers.get("retry-after")) * 1000,
          ).toISOString()
        : null;
      this.rateLimitStore.markRateLimited("twitterapi", {
        error: "HTTP 429 from twitterapi create_tweet_v2",
        resetAt,
      });

      throw normalizeTwitterApiHttpError({
        statusCode: response.status,
        body: await response.json().catch(() => null),
        resetAt,
      });
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      this.logger.error("twitterapi create_tweet_v2 failed.", errorBody);
      throw normalizeTwitterApiHttpError({
        statusCode: response.status,
        body: errorBody,
      });
    }

    const json = (await response.json()) as unknown;
    const parsed = twitterApiCreateTweetResponseSchema.parse(json);

    if (parsed.status !== "success" || parsed.tweet_id.length === 0) {
      throw normalizeTwitterApiSemanticError(json);
    }

    this.rateLimitStore.clear("twitterapi");

    return parsed;
  }
}
