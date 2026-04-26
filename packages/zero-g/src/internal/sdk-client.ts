import { Batcher, Indexer, KvClient, MemData, getFlowContract } from "@0gfoundation/0g-ts-sdk";
import { err, ok, type Result } from "@omen/shared";
import {
  JsonRpcProvider,
  Wallet,
  keccak256,
  toUtf8Bytes,
} from "ethers";

const DEFAULT_EXPECTED_REPLICA = 1;
const DEFAULT_NAMESPACE_SEED = "omen-zero-g-kv-v1";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export type ZeroGSdkClientConfig = {
  indexerUrl: string;
  blockchainRpcUrl?: string | null;
  kvNodeUrl?: string | null;
  privateKey?: string | null;
  flowContractAddress?: string | null;
  expectedReplica?: number;
  namespaceSeed?: string;
  requestTimeoutMs?: number;
};

export type ZeroGUploadedObject = {
  locator: string;
  rootHash: string;
  rootHashes: string[];
  txHash: string | null;
  txHashes: string[];
  txSeq: number | null;
  txSeqs: number[];
};

export type ZeroGStoredValue = {
  key: string;
  value: string;
  streamId: string;
  encodedKey: string;
  locator: string;
  version: number;
  size: number;
};

export type ZeroGStoredKey = {
  key: string;
  streamId: string;
  encodedKey: string;
  locator: string;
  txHash: string;
  rootHash: string;
};

export class ZeroGSdkClient {
  private readonly blockchainRpcUrl: string | null;

  private readonly kvNodeUrl: string | null;

  private readonly privateKey: string | null;

  private readonly flowContractAddress: string | null;

  private readonly expectedReplica: number;

  private readonly namespaceSeed: string;

  private readonly requestTimeoutMs: number;

  constructor(private readonly config: ZeroGSdkClientConfig) {
    this.blockchainRpcUrl =
      config.blockchainRpcUrl?.trim() || null;
    this.kvNodeUrl = config.kvNodeUrl?.trim() || null;
    this.privateKey = config.privateKey?.trim() || null;
    this.flowContractAddress = config.flowContractAddress?.trim() || null;
    this.expectedReplica = config.expectedReplica ?? DEFAULT_EXPECTED_REPLICA;
    this.namespaceSeed = config.namespaceSeed ?? DEFAULT_NAMESPACE_SEED;
    this.requestTimeoutMs = config.requestTimeoutMs ?? 10_000;
  }

  async putKeyValue(
    key: string,
    value: Uint8Array,
  ): Promise<Result<ZeroGStoredKey, Error>> {
    const blockchainRpcUrl = this.requireBlockchainRpcUrl();

    if (!blockchainRpcUrl.ok) {
      return blockchainRpcUrl;
    }

    const signer = this.createSigner(blockchainRpcUrl.value);
    const indexer = new Indexer(this.config.indexerUrl);

    try {
      const selectedNodes = await this.withTimeout(
        indexer.selectNodes(this.expectedReplica),
        "0G indexer node selection timed out.",
      );
      const [clients, selectError] = selectedNodes;

      if (selectError || clients.length === 0) {
        return err(
          selectError ?? new Error("0G indexer did not return any writable storage nodes."),
        );
      }

      const flowAddress = await this.resolveFlowAddress(clients);

      if (!flowAddress.ok) {
        return flowAddress;
      }

      const batcher = new Batcher(
        1,
        clients,
        getFlowContract(flowAddress.value, signer),
        blockchainRpcUrl.value,
      );
      const streamId = this.deriveStreamId(key);
      const encodedKeyBytes = this.encodeKeyBytes(key);

      batcher.streamDataBuilder.set(streamId, encodedKeyBytes, value);

      const executed = await this.withTimeout(
        batcher.exec(),
        "0G KV batch execution timed out.",
      );
      const [result, execError] = executed;

      if (execError) {
        return err(execError);
      }

      const encodedKey = this.encodeKeyBase64(key);

      return ok({
        key,
        streamId,
        encodedKey,
        locator: this.buildKvLocator(streamId, encodedKey),
        txHash: result.txHash,
        rootHash: result.rootHash,
      });
    } catch (error) {
      return err(
        error instanceof Error ? error : new Error("0G KV write failed."),
      );
    }
  }

  async getKeyValue(key: string): Promise<Result<ZeroGStoredValue | null, Error>> {
    if (!this.kvNodeUrl) {
      return err(new Error("0G KV reads require ZERO_G_KV_NODE_URL."));
    }

    const streamId = this.deriveStreamId(key);
    const encodedKey = this.encodeKeyBase64(key);
    const client = new KvClient(this.kvNodeUrl);

    try {
      const value = await this.withTimeout(
        client.getValue(streamId, encodedKey as unknown as Uint8Array),
        "0G KV read timed out.",
      );

      if (!value) {
        return ok(null);
      }

      const decoded = Buffer.from(value.data, "base64");

      return ok({
        key,
        value: textDecoder.decode(decoded),
        streamId,
        encodedKey,
        locator: this.buildKvLocator(streamId, encodedKey),
        version: value.version,
        size: value.size,
      });
    } catch (error) {
      return err(
        error instanceof Error ? error : new Error("0G KV read failed."),
      );
    }
  }

  async uploadObject(input: {
    logicalName: string;
    bytes: Uint8Array;
  }): Promise<Result<ZeroGUploadedObject, Error>> {
    const blockchainRpcUrl = this.requireBlockchainRpcUrl();

    if (!blockchainRpcUrl.ok) {
      return blockchainRpcUrl;
    }

    const signer = this.createSigner(blockchainRpcUrl.value);
    const indexer = new Indexer(this.config.indexerUrl);
    const file = new MemData(input.bytes);

    try {
      const uploaded = await this.withTimeout(
        indexer.upload(file, blockchainRpcUrl.value, signer),
        "0G file upload timed out.",
      );
      const [result, uploadError] = uploaded;

      if (uploadError) {
        return err(uploadError);
      }

      if ("rootHash" in result) {
        return ok({
          locator: this.buildFileLocator(result.rootHash),
          rootHash: result.rootHash,
          rootHashes: [result.rootHash],
          txHash: result.txHash,
          txHashes: [result.txHash],
          txSeq: result.txSeq,
          txSeqs: [result.txSeq],
        });
      }

      const primaryRootHash = result.rootHashes[0] ?? "";

      if (!primaryRootHash) {
        return err(
          new Error(`0G upload completed for ${input.logicalName} without any root hashes.`),
        );
      }

      return ok({
        locator: this.buildFileLocator(primaryRootHash),
        rootHash: primaryRootHash,
        rootHashes: result.rootHashes,
        txHash: result.txHashes[0] ?? null,
        txHashes: result.txHashes,
        txSeq: result.txSeqs[0] ?? null,
        txSeqs: result.txSeqs,
      });
    } catch (error) {
      return err(
        error instanceof Error ? error : new Error("0G file upload failed."),
      );
    }
  }

  deriveStreamId(key: string) {
    const marker = "/kv/";
    const streamNamespace =
      key.includes(marker) ? key.split(marker)[0] ?? key : key;

    return keccak256(toUtf8Bytes(`${this.namespaceSeed}:${streamNamespace}`));
  }

  encodeKeyBase64(key: string) {
    return Buffer.from(this.encodeKeyBytes(key)).toString("base64");
  }

  private requireBlockchainRpcUrl(): Result<string, Error> {
    if (!this.blockchainRpcUrl) {
      return err(new Error("0G writes require ZERO_G_RPC_URL."));
    }

    if (!this.privateKey) {
      return err(new Error("0G writes require ZERO_G_PRIVATE_KEY."));
    }

    return ok(this.blockchainRpcUrl);
  }

  private createSigner(blockchainRpcUrl: string) {
    return new Wallet(this.privateKey!, new JsonRpcProvider(blockchainRpcUrl));
  }

  private encodeKeyBytes(key: string) {
    return textEncoder.encode(key);
  }

  private async resolveFlowAddress(clients: { getStatus(): Promise<{ networkIdentity?: { flowAddress?: string } } | null> }[]) {
    if (this.flowContractAddress) {
      return ok(this.flowContractAddress);
    }

    const firstNode = clients[0];

    if (!firstNode) {
      return err(new Error("0G indexer returned no nodes to resolve the flow contract."));
    }

    const status = await this.withTimeout(
      firstNode.getStatus(),
      "0G node status request timed out.",
    );
    const flowAddress = status?.networkIdentity?.flowAddress?.trim();

    if (!flowAddress) {
      return err(new Error("0G node status did not expose a flow contract address."));
    }

    return ok(flowAddress);
  }

  private async withTimeout<T>(promise: Promise<T>, message: string) {
    let timer: NodeJS.Timeout | null = null;

    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error(message));
          }, this.requestTimeoutMs);
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private buildKvLocator(streamId: string, encodedKey: string) {
    const base = this.kvNodeUrl ?? this.config.indexerUrl;
    return `${base.replace(/\/$/, "")}/kv/${streamId}/${encodeURIComponent(encodedKey)}`;
  }

  private buildFileLocator(rootHash: string) {
    return `0g://file/${rootHash}`;
  }
}
