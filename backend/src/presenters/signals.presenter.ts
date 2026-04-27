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
    currentPrice: signal.currentPrice,
    entryPrice: signal.entryPrice,
    targetPrice: signal.targetPrice,
    stopLoss: signal.stopLoss,
    signalStatus: signal.signalStatus,
    pnlPercent: signal.pnlPercent,
    riskReward: signal.riskReward,
    entryZone: signal.entryZone,
    invalidation: signal.invalidation,
    targets: signal.targets,
    whyNow: signal.whyNow,
    criticDecision: signal.criticDecision,
    reportStatus: signal.reportStatus,
    publishedAt: signal.publishedAt,
    createdAt: signal.createdAt,
    updatedAt: signal.updatedAt,
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
