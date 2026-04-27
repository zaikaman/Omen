import {
  signalDetailResponseSchema,
  signalFeedResponseSchema,
  signalListItemSchema,
  type Signal,
  type SignalDetailResponse,
  type SignalFeedResponse,
  type SignalListItem,
} from "@omen/shared";

export const presentSignalListItem = (signal: Signal): SignalListItem =>
  signalListItemSchema.parse({
    id: signal.id,
    runId: signal.runId,
    asset: signal.asset,
    direction: signal.direction,
    confidence: signal.confidence,
    riskReward: signal.riskReward,
    criticDecision: signal.criticDecision,
    reportStatus: signal.reportStatus,
    publishedAt: signal.publishedAt,
  });

export type SignalFeedPresenterInput = {
  items: Signal[];
  total: number;
  nextCursor?: string | null;
};

export const presentSignalFeed = (
  input: SignalFeedPresenterInput,
): SignalFeedResponse =>
  signalFeedResponseSchema.parse({
    items: input.items.map((signal) => presentSignalListItem(signal)),
    total: input.total,
    nextCursor: input.nextCursor ?? null,
  });

export const presentSignalDetail = (signal: Signal): SignalDetailResponse =>
  signalDetailResponseSchema.parse({
    item: signal,
  });
