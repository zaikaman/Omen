import { ok, type Result } from "@omen/shared";
import { z } from "zod";

export const zeroGChainConfigSchema = z.object({
  rpcUrl: z.string().url(),
  chainId: z.union([z.string().min(1), z.number().int().positive()]),
});

export const zeroGChainProofSchema = z.object({
  manifestRoot: z.string().min(1),
  contractAddress: z.string().min(1).nullable(),
  transactionHash: z.string().min(1).nullable(),
  chainId: z.string().min(1),
});

export type ZeroGChainConfig = z.infer<typeof zeroGChainConfigSchema>;
export type ZeroGChainProof = z.infer<typeof zeroGChainProofSchema>;

export class ZeroGChainAdapter {
  private readonly config: ZeroGChainConfig;

  constructor(config: z.input<typeof zeroGChainConfigSchema>) {
    this.config = zeroGChainConfigSchema.parse(config);
  }

  async createProofAnchor(manifestRoot: string): Promise<Result<ZeroGChainProof, Error>> {
    return ok({
      manifestRoot,
      contractAddress: null,
      transactionHash: null,
      chainId: this.config.chainId.toString(),
    });
  }
}
