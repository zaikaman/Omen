import { chainProofSchema, ok, type ChainProof, type Result } from "@omen/shared";
import {
  Contract,
  JsonRpcProvider,
  Wallet,
  getAddress,
  isHexString,
  keccak256,
  toUtf8Bytes,
} from "ethers";
import { z } from "zod";

import { omenRunRegistryAbi } from "./omen-run-registry.js";

export const zeroGChainConfigSchema = z.object({
  rpcUrl: z.string().url(),
  chainId: z.union([z.string().min(1), z.number().int().positive()]),
  privateKey: z.string().min(1).optional(),
  runRegistryAddress: z.string().min(1).optional(),
  explorerBaseUrl: z.string().url().optional(),
});

export type ZeroGChainConfig = z.infer<typeof zeroGChainConfigSchema>;
export type ZeroGChainProof = ChainProof;

export const normalizeManifestRootForContract = (manifestRoot: string) => {
  const trimmed = manifestRoot.trim();

  if (!trimmed) {
    throw new Error("Manifest root is required for 0G chain anchoring.");
  }

  if (isHexString(trimmed, 32)) {
    return trimmed;
  }

  return keccak256(toUtf8Bytes(trimmed));
};

const buildExplorerUrl = (baseUrl: string | undefined, transactionHash: string) => {
  if (!baseUrl) {
    return null;
  }

  const trimmedBaseUrl = baseUrl.replace(/\/$/, "");

  if (trimmedBaseUrl.endsWith("/tx")) {
    return `${trimmedBaseUrl}/${transactionHash}`;
  }

  return `${trimmedBaseUrl}/tx/${transactionHash}`;
};

export class ZeroGChainAdapter {
  private readonly config: ZeroGChainConfig;

  constructor(config: z.input<typeof zeroGChainConfigSchema>) {
    this.config = zeroGChainConfigSchema.parse(config);
  }

  async createProofAnchor(input: {
    runId: string;
    manifestRoot: string;
    manifestUri: string;
  }): Promise<Result<ZeroGChainProof, Error>> {
    if (!this.config.privateKey) {
      return {
        ok: false,
        error: new Error("0G run registry anchoring requires ZERO_G_PRIVATE_KEY."),
      };
    }

    if (!this.config.runRegistryAddress) {
      return {
        ok: false,
        error: new Error(
          "0G run registry anchoring requires ZERO_G_RUN_REGISTRY_ADDRESS.",
        ),
      };
    }

    try {
      const signer = new Wallet(
        this.config.privateKey,
        new JsonRpcProvider(this.config.rpcUrl),
      );
      const contractAddress = getAddress(this.config.runRegistryAddress);
      const registry = new Contract(contractAddress, omenRunRegistryAbi, signer);
      const transaction = await registry.anchorRun(
        input.runId,
        normalizeManifestRootForContract(input.manifestRoot),
        input.manifestUri,
      );
      const receipt = await transaction.wait();
      const explorerUrl = buildExplorerUrl(
        this.config.explorerBaseUrl,
        transaction.hash,
      );

      return ok(chainProofSchema.parse({
        manifestRoot: input.manifestRoot,
        status: "anchored",
        contractAddress,
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
            : new Error("0G run registry anchoring failed."),
      };
    }
  }
}
