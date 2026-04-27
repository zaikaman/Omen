import {
  intelDetailResponseSchema,
  intelFeedResponseSchema,
  intelListItemSchema,
  type Intel,
  type IntelDetailResponse,
  type IntelFeedResponse,
  type IntelListItem,
} from "@omen/shared";

export const presentIntelListItem = (intel: Intel): IntelListItem =>
  intelListItemSchema.parse({
    id: intel.id,
    runId: intel.runId,
    title: intel.title,
    slug: intel.slug,
    summary: intel.summary,
    category: intel.category,
    status: intel.status,
    symbols: intel.symbols,
    confidence: intel.confidence,
    publishedAt: intel.publishedAt,
    createdAt: intel.createdAt,
  });

export type IntelFeedPresenterInput = {
  items: Intel[];
  nextCursor?: string | null;
};

export const presentIntelFeed = (
  input: IntelFeedPresenterInput,
): IntelFeedResponse =>
  intelFeedResponseSchema.parse({
    items: input.items.map((intel) => presentIntelListItem(intel)),
    nextCursor: input.nextCursor ?? null,
  });

export const presentIntelDetail = (intel: Intel): IntelDetailResponse =>
  intelDetailResponseSchema.parse({
    item: intel,
  });
