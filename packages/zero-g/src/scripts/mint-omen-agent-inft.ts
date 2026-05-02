import { Contract, JsonRpcProvider, Wallet, getAddress, id } from "ethers";
import path from "node:path";

import { omenAgentInftAbi } from "../chain/omen-agent-inft.js";
import { ZeroGClientAdapter, type ZeroGAdapterConfig } from "../index.js";
import {
  canonicalJson,
  encryptInftPayload,
  keccak256Utf8,
  loadPublicKeyPem,
  sha256Hex,
} from "../inft/encryption.js";
import {
  buildOmenAgentIntelligenceBundle,
  hashOmenAgentBundle,
} from "../inft/omen-agent-intelligence.js";

const requireEnv = (name: string) => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
};

const optionalEnv = (name: string) => process.env[name]?.trim() || null;

const buildZeroGConfig = (): ZeroGAdapterConfig => ({
  storage: {
    indexerUrl: requireEnv("ZERO_G_INDEXER_URL"),
    evmRpcUrl: requireEnv("ZERO_G_RPC_URL"),
    kvNodeUrl: optionalEnv("ZERO_G_KV_NODE_URL") ?? undefined,
    privateKey: requireEnv("ZERO_G_PRIVATE_KEY"),
    flowContractAddress: optionalEnv("ZERO_G_FLOW_CONTRACT_ADDRESS") ?? undefined,
    expectedReplica: Number.parseInt(optionalEnv("ZERO_G_EXPECTED_REPLICA") ?? "1", 10),
    namespaceSeed: optionalEnv("ZERO_G_NAMESPACE_SEED") ?? "omen-zero-g-kv-v1",
    requestTimeoutMs: Number.parseInt(optionalEnv("ZERO_G_REQUEST_TIMEOUT_MS") ?? "180000", 10),
  },
  log: {
    baseUrl: requireEnv("ZERO_G_INDEXER_URL"),
    evmRpcUrl: requireEnv("ZERO_G_RPC_URL"),
    privateKey: requireEnv("ZERO_G_PRIVATE_KEY"),
    expectedReplica: Number.parseInt(optionalEnv("ZERO_G_EXPECTED_REPLICA") ?? "1", 10),
    requestTimeoutMs: Number.parseInt(optionalEnv("ZERO_G_REQUEST_TIMEOUT_MS") ?? "180000", 10),
  },
});

const buildExplorerUrl = (baseUrl: string | null, txHash: string) => {
  if (!baseUrl) {
    return null;
  }

  const trimmed = baseUrl.replace(/\/$/, "");

  return trimmed.endsWith("/tx") ? `${trimmed}/${txHash}` : `${trimmed}/tx/${txHash}`;
};

const parseMintedTokenId = (receiptLogs: readonly unknown[], inft: Contract) => {
  for (const log of receiptLogs) {
    try {
      const parsed = inft.interface.parseLog(log as Parameters<typeof inft.interface.parseLog>[0]);

      if (parsed?.name === "MintedAgent") {
        return parsed.args.tokenId.toString();
      }
    } catch {
      // Ignore logs emitted by other contracts in the same transaction.
    }
  }

  return null;
};

const main = async () => {
  const repoRoot = process.env.INIT_CWD ?? process.cwd();
  const rpcUrl = requireEnv("ZERO_G_RPC_URL");
  const privateKey = requireEnv("ZERO_G_PRIVATE_KEY");
  const chainId = optionalEnv("ZERO_G_CHAIN_ID") ?? "16602";
  const explorerBaseUrl = optionalEnv("ZERO_G_CHAIN_EXPLORER_BASE_URL");
  const inftAddress = getAddress(requireEnv("OMEN_INFT_CONTRACT_ADDRESS"));
  const recipient = getAddress(
    optionalEnv("OMEN_INFT_RECIPIENT_ADDRESS") ?? new Wallet(privateKey).address,
  );
  const ownerPublicKeyPem = await loadPublicKeyPem({
    publicKeyPem: optionalEnv("OMEN_INFT_OWNER_PUBLIC_KEY_PEM"),
    publicKeyPath: optionalEnv("OMEN_INFT_OWNER_PUBLIC_KEY_PATH")
      ? path.resolve(repoRoot, optionalEnv("OMEN_INFT_OWNER_PUBLIC_KEY_PATH")!)
      : null,
  });
  const memoryRoot = requireEnv("OMEN_INFT_MEMORY_ROOT");
  const memoryDescription =
    optionalEnv("OMEN_INFT_MEMORY_DESCRIPTION") ??
    "0G Storage memory root for the Omen swarm's latest durable state.";
  const proofManifestUri = optionalEnv("OMEN_INFT_PROOF_MANIFEST_URI");
  const latestRunId = optionalEnv("OMEN_INFT_LATEST_RUN_ID");
  const computeModel = optionalEnv("ZERO_G_COMPUTE_MODEL") ?? "qwen/qwen-2.5-7b-instruct";
  const bundle = await buildOmenAgentIntelligenceBundle({
    repoRoot,
    memoryRoot,
    memoryDescription,
    proofManifestUri,
    latestRunId,
    chainId,
    computeModel,
  });
  const plaintext = canonicalJson(bundle);
  const bundleSha256 = hashOmenAgentBundle(bundle);
  const encrypted = encryptInftPayload({
    plaintext,
    ownerPublicKeyPem,
  });
  const adapter = new ZeroGClientAdapter(buildZeroGConfig());
  const encryptedEnvelope = canonicalJson({
    schemaVersion: "omen-agent-inft-encrypted/v1",
    project: "Omen",
    contentType: "application/json",
    compression: null,
    encryption: encrypted.encryption,
    ciphertextBase64: Buffer.from(encrypted.encryptedBytes).toString("base64"),
  });
  const uploaded = await adapter.uploadFile({
    fileName: `omen/inft/swarm/${Date.now().toString()}-encrypted-intelligence.json`,
    contentType: "application/json",
    bytes: new TextEncoder().encode(encryptedEnvelope),
    metadata: {
      artifactType: "omen_agent_inft_intelligence",
      bundleSha256,
      latestRunId,
      proofManifestUri,
      memoryRoot,
    },
  });

  if (!uploaded.ok) {
    throw uploaded.error;
  }

  const provider = new JsonRpcProvider(rpcUrl);
  const signer = new Wallet(privateKey, provider);
  const inft = new Contract(inftAddress, omenAgentInftAbi, signer);
  const promptManifestHash = sha256Hex(
    canonicalJson(bundle.prompts.map((prompt) => ({ path: prompt.path, sha256: prompt.sha256 }))),
  );
  const proofManifestHash = sha256Hex(proofManifestUri ?? memoryRoot);
  const intelligentData = [
    {
      dataDescription: `encrypted-swarm-intelligence:${uploaded.value.locator}`,
      dataHash: encrypted.encryption.ciphertextKeccak256,
    },
    {
      dataDescription: `memory-root:${memoryRoot}`,
      dataHash: keccak256Utf8(memoryRoot),
    },
    {
      dataDescription: `proof-manifest:${proofManifestUri ?? memoryRoot}`,
      dataHash: id(proofManifestHash),
    },
    {
      dataDescription: `prompt-manifest:${promptManifestHash}`,
      dataHash: id(promptManifestHash),
    },
  ];
  const mintTx = await inft.mint(recipient, uploaded.value.locator, intelligentData, [
    encrypted.encryption.sealedKey,
  ]);
  const receipt = await mintTx.wait();
  const tokenId = parseMintedTokenId(receipt?.logs ?? [], inft);

  console.log(
    JSON.stringify(
      {
        contractAddress: inftAddress,
        tokenId,
        recipient,
        mintTransactionHash: mintTx.hash,
        mintExplorerUrl: buildExplorerUrl(explorerBaseUrl, mintTx.hash),
        encryptedIntelligence: {
          locator: uploaded.value.locator,
          rootHashHint: uploaded.value.metadata.rootHashHint ?? null,
          ciphertextKeccak256: encrypted.encryption.ciphertextKeccak256,
          plaintextSha256: encrypted.encryption.plaintextSha256,
          bundleSha256,
        },
        memory: {
          root: memoryRoot,
          proofManifestUri,
          latestRunId,
        },
        intelligentData,
        sealedKey: {
          algorithm: encrypted.encryption.sealedKeyAlgorithm,
          sha256: sha256Hex(encrypted.encryption.sealedKey),
        },
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
