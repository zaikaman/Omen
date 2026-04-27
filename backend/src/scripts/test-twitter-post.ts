import { createBackendEnv } from "../bootstrap/env.js";
import { createLogger } from "../bootstrap/logger.js";
import { TwitterApiClient } from "../services/x/twitterapi-client.js";

const env = createBackendEnv(process.env);
const logger = createLogger(env);
const client = new TwitterApiClient(
  {
    apiKey: env.twitterApi.apiKey ?? "",
    baseUrl: env.twitterApi.baseUrl,
    loginCookies: env.twitterApi.loginCookies,
    proxy: env.twitterApi.proxy ?? "",
    userName: env.twitterApi.userName,
    email: env.twitterApi.email,
    password: env.twitterApi.password,
    totpSecret: env.twitterApi.totpSecret,
  },
  logger,
);

async function main() {
  const timestamp = new Date().toISOString();
  const result = await client.createTweet({
    text: `Omen posting path test ${timestamp}. Infrastructure validation only.`,
    replyToTweetId: null,
    quoteTweetId: null,
    attachmentUrl: null,
    communityId: null,
    isNoteTweet: false,
    mediaIds: [],
    scheduleFor: null,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        tweetId: result.tweet_id,
        status: result.status,
        msg: result.msg ?? null,
        url: `https://x.com/i/web/status/${result.tweet_id}`,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(message);
  process.exitCode = 1;
});
