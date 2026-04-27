import { z } from "zod";

export const intelStatusSchema = z.enum([
  "draft",
  "ready",
  "published",
  "suppressed",
]);

export const intelCategorySchema = z.enum([
  "market_update",
  "narrative_shift",
  "token_watch",
  "macro",
  "opportunity",
]);

export const intelSourceSchema = z.object({
  label: z.string().min(1),
  url: z.string().url().nullable(),
  provider: z.string().min(1),
});

export const intelSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  title: z.string().min(1),
  slug: z.string().min(1),
  summary: z.string().min(1),
  body: z.string().min(1),
  category: intelCategorySchema,
  status: intelStatusSchema,
  symbols: z.array(z.string().min(1)).default([]),
  confidence: z.number().min(0).max(100),
  imagePrompt: z.string().min(1).nullable().default(null),
  imageUrl: z.string().url().nullable().default(null),
  sources: z.array(intelSourceSchema).default([]),
  proofRefIds: z.array(z.string().min(1)).default([]),
  publishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const intelListItemSchema = intelSchema.pick({
  id: true,
  runId: true,
  title: true,
  slug: true,
  summary: true,
  category: true,
  status: true,
  symbols: true,
  confidence: true,
  imageUrl: true,
  publishedAt: true,
  createdAt: true,
});

export type IntelStatus = z.infer<typeof intelStatusSchema>;
export type IntelCategory = z.infer<typeof intelCategorySchema>;
export type IntelSource = z.infer<typeof intelSourceSchema>;
export type Intel = z.infer<typeof intelSchema>;
export type IntelListItem = z.infer<typeof intelListItemSchema>;
