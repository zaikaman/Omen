import { chainProofSchema, ok, type ChainProof, type Result } from "@omen/shared";
import { z } from "zod";

export const zeroGChainConfigSchema = z.object({
  rpcUrl: z.string().url(),
  chainId: z.union([z.string().min(1), z.number().int().positive()]),
});

export type ZeroGChainConfig = z.infer<typeof zeroGChainConfigSchema>;
export type ZeroGChainProof = ChainProof;

export class ZeroGChainAdapter {
  private readonly config: ZeroGChainConfig;

  constructor(config: z.input<typeof zeroGChainConfigSchema>) {
    this.config = zeroGChainConfigSchema.parse(config);
  }

  async createProofAnchor(manifestRoot: string): Promise<Result<ZeroGChainProof, Error>> {
    return ok(chainProofSchema.parse({
      manifestRoot,
      status: "anchored",
      contractAddress: null,
      transactionHash: null,
      chainId: this.config.chainId.toString(),
      blockNumber: null,
      explorerUrl: null,
      anchoredAt: new Date().toISOString(),
    }));
  }
}
