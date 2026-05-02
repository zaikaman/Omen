import { proofArtifactSchema, type ProofArtifact, type Result } from "@omen/shared";
import { Contract, JsonRpcProvider, Wallet, getAddress, id } from "ethers";

import { omenAgentInftAbi } from "../chain/omen-agent-inft.js";
import { type ZeroGAdapterConfig, ZeroGClientAdapter } from "../adapters/zero-g-adapter.js";
import {
  canonicalJson,
  encryptInftPayload,
  keccak256Utf8,
  loadPublicKeyPem,
  sha256Hex,
} from "./encryption.js";
import {
  buildOmenAgentIntelligenceBundle,
  hashOmenAgentBundle,
} from "./omen-agent-intelligence.js";

const buildExplorerUrl = (baseUrl: string | undefined, txHash: string) => {
  if (!baseUrl) {
    return null;
  }

  const trimmed = baseUrl.replace(/\/$/, "");

  return trimmed.endsWith("/tx") ? `${trimmed}/${txHash}` : `${trimmed}/tx/${txHash}`;
};

export class OmenAgentInftPublisher {
  private readonly adapter: ZeroGClientAdapter;

  constructor(
    private readonly input: {
      zeroG: ZeroGAdapterConfig;
      repoRoot: string;
      contractAddress: string;
      tokenId: string | number | bigint;
      ownerPublicKeyPem?: string | null;
      ownerPublicKeyPath?: string | null;
      computeModel: string;
    },
  ) {
    this.adapter = new ZeroGClientAdapter(input.zeroG);
  }

  async publishRunIntelligence(input: {
    runId: string;
    signalId: string | null;
    intelId: string | null;
    memoryRoot: string;
    proofManifestUri: string;
    memoryDescription?: string | null;
  }): Promise<Result<ProofArtifact, Error>> {
    if (!this.input.zeroG.chain?.privateKey) {
      return {
        ok: false,
        error: new Error("iNFT intelligence updates require ZERO_G_PRIVATE_KEY."),
      };
    }

    if (!this.input.zeroG.chain.rpcUrl) {
      return {
        ok: false,
        error: new Error("iNFT intelligence updates require ZERO_G_RPC_URL."),
      };
    }

    try {
      const ownerPublicKeyPem = await loadPublicKeyPem({
        publicKeyPem: this.input.ownerPublicKeyPem,
        publicKeyPath: this.input.ownerPublicKeyPath,
      });
      const bundle = await buildOmenAgentIntelligenceBundle({
        repoRoot: this.input.repoRoot,
        memoryRoot: input.memoryRoot,
        memoryDescription:
          input.memoryDescription ??
          "Latest durable Omen swarm state and proof manifest root on 0G Storage.",
        proofManifestUri: input.proofManifestUri,
        latestRunId: input.runId,
        chainId: this.input.zeroG.chain.chainId.toString(),
        computeModel: this.input.computeModel,
      });
      const plaintext = canonicalJson(bundle);
      const bundleSha256 = hashOmenAgentBundle(bundle);
      const encrypted = encryptInftPayload({
        plaintext,
        ownerPublicKeyPem,
      });
      const encryptedEnvelope = canonicalJson({
        schemaVersion: "omen-agent-inft-encrypted/v1",
        project: "Omen",
        contentType: "application/json",
        compression: null,
        encryption: encrypted.encryption,
        ciphertextBase64: Buffer.from(encrypted.encryptedBytes).toString("base64"),
      });
      const uploaded = await this.adapter.uploadFile({
        fileName: `omen/inft/swarm/${input.runId}/encrypted-intelligence.json`,
        contentType: "application/json",
        bytes: new TextEncoder().encode(encryptedEnvelope),
        metadata: {
          artifactType: "omen_agent_inft_intelligence",
          bundleSha256,
          latestRunId: input.runId,
          proofManifestUri: input.proofManifestUri,
          memoryRoot: input.memoryRoot,
        },
      });

      if (!uploaded.ok) {
        return uploaded;
      }

      const promptManifestHash = sha256Hex(
        canonicalJson(
          bundle.prompts.map((prompt) => ({ path: prompt.path, sha256: prompt.sha256 })),
        ),
      );
      const proofManifestHash = sha256Hex(input.proofManifestUri);
      const intelligentData = [
        {
          dataDescription: `encrypted-swarm-intelligence:${uploaded.value.locator}`,
          dataHash: encrypted.encryption.ciphertextKeccak256,
        },
        {
          dataDescription: `memory-root:${input.memoryRoot}`,
          dataHash: keccak256Utf8(input.memoryRoot),
        },
        {
          dataDescription: `proof-manifest:${input.proofManifestUri}`,
          dataHash: id(proofManifestHash),
        },
        {
          dataDescription: `prompt-manifest:${promptManifestHash}`,
          dataHash: id(promptManifestHash),
        },
      ];
      const signer = new Wallet(
        this.input.zeroG.chain.privateKey,
        new JsonRpcProvider(this.input.zeroG.chain.rpcUrl),
      );
      const inft = new Contract(getAddress(this.input.contractAddress), omenAgentInftAbi, signer);
      const tx = await inft.updateIntelligence(
        this.input.tokenId,
        input.runId,
        uploaded.value.locator,
        intelligentData,
        [encrypted.encryption.sealedKey],
      );
      const receipt = await tx.wait();

      return {
        ok: true,
        value: proofArtifactSchema.parse({
          id: `${input.runId}:inft-intelligence`,
          runId: input.runId,
          signalId: input.signalId,
          intelId: input.intelId,
          refType: "chain_proof",
          key: null,
          locator: tx.hash,
          metadata: {
            artifactType: "inft_intelligence_update",
            contractAddress: getAddress(this.input.contractAddress),
            tokenId: this.input.tokenId.toString(),
            transactionHash: tx.hash,
            blockNumber: receipt?.blockNumber ?? null,
            encryptedIntelligenceUri: uploaded.value.locator,
            encryptedIntelligenceArtifactId: uploaded.value.id,
            ciphertextKeccak256: encrypted.encryption.ciphertextKeccak256,
            plaintextSha256: encrypted.encryption.plaintextSha256,
            bundleSha256,
            memoryRoot: input.memoryRoot,
            proofManifestUri: input.proofManifestUri,
            explorerUrl: buildExplorerUrl(this.input.zeroG.chain.explorerBaseUrl, tx.hash),
          },
          compute: null,
          createdAt: new Date().toISOString(),
        }),
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error("iNFT intelligence update failed."),
      };
    }
  }
}
