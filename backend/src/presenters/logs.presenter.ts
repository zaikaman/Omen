import {
  logFeedResponseSchema,
  type AgentEvent,
  type LogFeedResponse,
} from "@omen/shared";

export type LogFeedPresenterInput = {
  items: AgentEvent[];
  nextCursor?: string | null;
};

export const presentLogFeed = (input: LogFeedPresenterInput): LogFeedResponse =>
  logFeedResponseSchema.parse({
    items: input.items,
    nextCursor: input.nextCursor ?? null,
  });
