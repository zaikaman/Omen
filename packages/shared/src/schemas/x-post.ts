import { z } from "zod";

export const xPostDraftSchema = z.object({
  text: z.string().min(1).max(25_000),
  replyToTweetId: z.string().min(1).nullable(),
  quoteTweetId: z.string().min(1).nullable(),
  attachmentUrl: z.string().url().nullable(),
  communityId: z.string().min(1).nullable(),
  isNoteTweet: z.boolean().default(false),
  mediaIds: z.array(z.string().min(1)).default([]),
  scheduleFor: z.string().datetime().nullable(),
});

export const twitterApiCreateTweetRequestSchema = z
  .object({
    login_cookies: z.string().min(1),
    tweet_text: z.string().min(1).max(25_000),
    proxy: z.string().min(1),
    reply_to_tweet_id: z.string().min(1).optional(),
    attachment_url: z.string().url().optional(),
    community_id: z.string().min(1).optional(),
    is_note_tweet: z.boolean().optional(),
    media_ids: z.array(z.string().min(1)).optional(),
    quote_tweet_id: z.string().min(1).optional(),
    schedule_for: z.string().datetime().optional(),
  })
  .superRefine((input, ctx) => {
    if (input.quote_tweet_id && input.attachment_url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use either quote_tweet_id or attachment_url, not both.",
        path: ["quote_tweet_id"],
      });
    }
  });

export const twitterApiCreateTweetResponseSchema = z.object({
  tweet_id: z.string().min(1).optional(),
  id: z.string().min(1).optional(),
  data: z
    .object({
      id: z.string().min(1).optional(),
      tweet_id: z.string().min(1).optional(),
    })
    .optional(),
  status: z.string().min(1),
  msg: z.string().min(1).optional(),
}).transform((value) => ({
  ...value,
  tweet_id: value.tweet_id ?? value.id ?? value.data?.tweet_id ?? value.data?.id ?? "",
}));

export const twitterApiCredentialsSchema = z.object({
  apiKey: z.string().min(1),
  loginCookies: z.string().min(1).nullable().default(null),
  proxy: z.string().min(1),
  baseUrl: z.string().url().default("https://api.twitterapi.io"),
  userName: z.string().min(1).nullable().default(null),
  email: z.string().min(1).nullable().default(null),
  password: z.string().min(1).nullable().default(null),
  totpSecret: z.string().min(1).nullable().default(null),
});

export type XPostDraft = z.infer<typeof xPostDraftSchema>;
export type TwitterApiCreateTweetRequest = z.infer<
  typeof twitterApiCreateTweetRequestSchema
>;
export type TwitterApiCreateTweetResponse = z.infer<
  typeof twitterApiCreateTweetResponseSchema
>;
export type TwitterApiCredentials = z.infer<typeof twitterApiCredentialsSchema>;
