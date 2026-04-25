import { z } from "zod";

import { agentEventSchema } from "../event.js";

export const logFeedResponseSchema = z.object({
  items: z.array(agentEventSchema),
  nextCursor: z.string().min(1).nullable(),
});

export type LogFeedResponse = z.infer<typeof logFeedResponseSchema>;
