import { z } from "zod";

export const chainAnchorStatusSchema = z.enum([
  "pending",
  "anchored",
  "skipped",
  "failed",
]);

export const chainProofSchema = z
  .object({
    manifestRoot: z.string().min(1),
    chainId: z.string().min(1),
    status: chainAnchorStatusSchema,
    contractAddress: z.string().min(1).nullable(),
    transactionHash: z.string().min(1).nullable(),
    blockNumber: z.number().int().min(0).nullable(),
    explorerUrl: z.string().url().nullable(),
    anchoredAt: z.string().datetime().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.status === "anchored" && !value.anchoredAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Anchored chain proofs require an anchoredAt timestamp.",
        path: ["anchoredAt"],
      });
    }
  });

export type ChainAnchorStatus = z.infer<typeof chainAnchorStatusSchema>;
export type ChainProof = z.infer<typeof chainProofSchema>;
