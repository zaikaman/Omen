import type { Request, Response } from "express";

import type { BackendEnv } from "../bootstrap/env.js";

const isPlaceholder = (value: string | null | undefined) =>
  !value ||
  value.includes("your_") ||
  value.includes("0xyour") ||
  value.includes("<");

const buildExplorerUrl = (
  baseUrl: string | null,
  kind: "tx" | "address",
  value: string | null,
) => {
  if (!baseUrl || !value) {
    return null;
  }

  const base = baseUrl.replace(/\/$/, "").replace(/\/tx$/, "");

  return `${base}/${kind}/${value}`;
};

export const createInftController =
  (env: Pick<BackendEnv, "inft" | "zeroG">) =>
  (_req: Request, res: Response) => {
    const configured =
      !isPlaceholder(env.inft.contractAddress) &&
      !isPlaceholder(env.inft.tokenId) &&
      !isPlaceholder(env.inft.encryptedIntelligenceUri) &&
      !isPlaceholder(env.inft.memoryRoot);

    res.json({
      success: true,
      data: {
        configured,
        contractAddress: isPlaceholder(env.inft.contractAddress)
          ? null
          : env.inft.contractAddress,
        tokenId: isPlaceholder(env.inft.tokenId) ? null : env.inft.tokenId,
        ownerAddress: isPlaceholder(env.inft.ownerAddress) ? null : env.inft.ownerAddress,
        attestorAddress: isPlaceholder(env.inft.attestorAddress)
          ? null
          : env.inft.attestorAddress,
        encryptedIntelligenceUri: isPlaceholder(env.inft.encryptedIntelligenceUri)
          ? null
          : env.inft.encryptedIntelligenceUri,
        memoryRoot: isPlaceholder(env.inft.memoryRoot) ? null : env.inft.memoryRoot,
        proofManifestUri: isPlaceholder(env.inft.proofManifestUri)
          ? null
          : env.inft.proofManifestUri,
        latestRunId: isPlaceholder(env.inft.latestRunId) ? null : env.inft.latestRunId,
        mintTransactionHash: isPlaceholder(env.inft.mintTransactionHash)
          ? null
          : env.inft.mintTransactionHash,
        contractExplorerUrl: buildExplorerUrl(
          env.zeroG.chainExplorerBaseUrl,
          "address",
          isPlaceholder(env.inft.contractAddress) ? null : env.inft.contractAddress,
        ),
        mintExplorerUrl: buildExplorerUrl(
          env.zeroG.chainExplorerBaseUrl,
          "tx",
          isPlaceholder(env.inft.mintTransactionHash)
            ? null
            : env.inft.mintTransactionHash,
        ),
        chainId: env.zeroG.chainId,
      },
    });
  };
