import { apiRequest } from './client';

export type InftProofResponse = {
  configured: boolean;
  contractAddress: string | null;
  tokenId: string | null;
  ownerAddress: string | null;
  attestorAddress: string | null;
  encryptedIntelligenceUri: string | null;
  memoryRoot: string | null;
  proofManifestUri: string | null;
  latestRunId: string | null;
  mintTransactionHash: string | null;
  contractExplorerUrl: string | null;
  mintExplorerUrl: string | null;
  chainId: string;
};

const nullableString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value : null;

const inftProofResponseSchema = {
  parse: (input: unknown): InftProofResponse => {
    const payload = input as Partial<InftProofResponse>;

    return {
      configured: payload.configured === true,
      contractAddress: nullableString(payload.contractAddress),
      tokenId: nullableString(payload.tokenId),
      ownerAddress: nullableString(payload.ownerAddress),
      attestorAddress: nullableString(payload.attestorAddress),
      encryptedIntelligenceUri: nullableString(payload.encryptedIntelligenceUri),
      memoryRoot: nullableString(payload.memoryRoot),
      proofManifestUri: nullableString(payload.proofManifestUri),
      latestRunId: nullableString(payload.latestRunId),
      mintTransactionHash: nullableString(payload.mintTransactionHash),
      contractExplorerUrl: nullableString(payload.contractExplorerUrl),
      mintExplorerUrl: nullableString(payload.mintExplorerUrl),
      chainId: nullableString(payload.chainId) ?? 'unknown',
    };
  },
};

export const getInftProof = (): Promise<InftProofResponse> =>
  apiRequest('/inft', inftProofResponseSchema);
