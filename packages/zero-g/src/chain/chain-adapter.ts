import { chainProofSchema, ok, type ChainProof, type Result } from "@omen/shared";
import { JsonRpcProvider, Wallet, hexlify, toUtf8Bytes } from "ethers";
import { z } from "zod";

export const zeroGChainConfigSchema = z.object({
  rpcUrl: z.string().url(),
  chainId: z.union([z.string().min(1), z.number().int().positive()]),
  privateKey: z.string().min(1).optional(),
  explorerBaseUrl: z.string().url().optional(),
});

export type ZeroGChainConfig = z.infer<typeof zeroGChainConfigSchema>;
export type ZeroGChainProof = ChainProof;

export class ZeroGChainAdapter {
  private readonly config: ZeroGChainConfig;

  constructor(config: z.input<typeof zeroGChainConfigSchema>) {
    this.config = zeroGChainConfigSchema.parse(config);
  }

  async createProofAnchor(manifestRoot: string): Promise<Result<ZeroGChainProof, Error>> {
    if (this.config.privateKey) {
      try {
        const signer = new Wallet(
          this.config.privateKey,
          new JsonRpcProvider(this.config.rpcUrl),
        );
        const address = await signer.getAddress();
        const transaction = await signer.sendTransaction({
          to: address,
          value: 0n,
          data: hexlify(toUtf8Bytes(manifestRoot)),
        });
        const receipt = await transaction.wait();
        const explorerUrl = this.config.explorerBaseUrl
          ? `${this.config.explorerBaseUrl.replace(/\/$/, "")}/${transaction.hash}`
          : null;

        return ok(chainProofSchema.parse({
          manifestRoot,
          status: "anchored",
          contractAddress: null,
          transactionHash: transaction.hash,
          chainId: this.config.chainId.toString(),
          blockNumber: receipt?.blockNumber ?? null,
          explorerUrl,
          anchoredAt: new Date().toISOString(),
        }));
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error
              ? error
              : new Error("0G chain proof anchoring failed."),
        };
      }
    }

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
