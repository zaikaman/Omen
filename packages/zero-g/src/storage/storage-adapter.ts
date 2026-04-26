import { err, ok, type Result } from "@omen/shared";
import { z } from "zod";

import { ZeroGSdkClient } from "../internal/sdk-client.js";

export const zeroGStorageConfigSchema = z.object({
  indexerUrl: z.string().url(),
  kvRpcUrl: z.string().url().optional(),
  evmRpcUrl: z.string().url().optional(),
  kvNodeUrl: z.string().url().optional(),
  privateKey: z.string().min(1).optional(),
  flowContractAddress: z.string().min(1).optional(),
  expectedReplica: z.number().int().min(1).default(1),
  namespaceSeed: z.string().min(1).default("omen-zero-g-kv-v1"),
  requestTimeoutMs: z.number().int().min(1).default(10_000),
});

export const zeroGStoragePutSchema = z.object({
  key: z.string().min(1),
  value: z.union([z.string(), z.instanceof(Uint8Array)]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const zeroGStorageValueSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const zeroGFileUploadSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  bytes: z.instanceof(Uint8Array),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type ZeroGStorageConfig = z.infer<typeof zeroGStorageConfigSchema>;
export type ZeroGStoragePutInput = z.infer<typeof zeroGStoragePutSchema>;
export type ZeroGStorageValue = z.infer<typeof zeroGStorageValueSchema>;
export type ZeroGFileUploadInput = z.infer<typeof zeroGFileUploadSchema>;

type ZeroGStorageSdkBridge = {
  putKeyValue(key: string, value: Uint8Array): Promise<
    Result<
      {
        locator: string;
        streamId: string;
        encodedKey: string;
        txHash: string;
        rootHash: string;
      },
      Error
    >
  >;
  getKeyValue(key: string): Promise<
    Result<
      {
        key: string;
        value: string;
        streamId: string;
        encodedKey: string;
        locator: string;
        version: number;
        size: number;
      } | null,
      Error
    >
  >;
  uploadObject(input: { logicalName: string; bytes: Uint8Array }): Promise<
    Result<
      {
        locator: string;
        rootHash: string;
        rootHashes: string[];
        txHash: string | null;
        txHashes: string[];
        txSeq: number | null;
        txSeqs: number[];
      },
      Error
    >
  >;
};

export class ZeroGStorageAdapter {
  private readonly config: ZeroGStorageConfig;

  private readonly bridge: ZeroGStorageSdkBridge;

  constructor(
    config: z.input<typeof zeroGStorageConfigSchema>,
    bridge?: ZeroGStorageSdkBridge,
  ) {
    this.config = zeroGStorageConfigSchema.parse(config);
    this.bridge =
      bridge ??
      new ZeroGSdkClient({
        indexerUrl: this.config.indexerUrl,
        blockchainRpcUrl: this.config.evmRpcUrl ?? this.config.kvRpcUrl ?? null,
        kvNodeUrl: this.config.kvNodeUrl ?? null,
        privateKey: this.config.privateKey ?? null,
        flowContractAddress: this.config.flowContractAddress ?? null,
        expectedReplica: this.config.expectedReplica,
        namespaceSeed: this.config.namespaceSeed,
        requestTimeoutMs: this.config.requestTimeoutMs,
      });
  }

  async putValue(
    input: z.input<typeof zeroGStoragePutSchema>,
  ): Promise<Result<{ locator: string; key: string }, Error>> {
    const parsed = zeroGStoragePutSchema.parse(input);
    const value =
      typeof parsed.value === "string"
        ? new TextEncoder().encode(parsed.value)
        : parsed.value;
    const stored = await this.bridge.putKeyValue(parsed.key, value);

    if (!stored.ok) {
      return stored;
    }

    return ok({
      locator: stored.value.locator,
      key: parsed.key,
    });
  }

  async getValue(key: string): Promise<Result<ZeroGStorageValue | null, Error>> {
    if (!key.trim()) {
      return err(new Error("0G KV key is required."));
    }

    const value = await this.bridge.getKeyValue(key);

    if (!value.ok) {
      return value;
    }

    if (!value.value) {
      return ok(null);
    }

    return ok(
      zeroGStorageValueSchema.parse({
        key: value.value.key,
        value: value.value.value,
        metadata: {
          locator: value.value.locator,
          streamId: value.value.streamId,
          encodedKey: value.value.encodedKey,
          version: value.value.version,
          size: value.value.size,
        },
      }),
    );
  }

  async uploadFile(
    input: z.input<typeof zeroGFileUploadSchema>,
  ): Promise<Result<{ locator: string; rootHashHint: string }, Error>> {
    const parsed = zeroGFileUploadSchema.parse(input);
    const uploaded = await this.bridge.uploadObject({
      logicalName: parsed.fileName,
      bytes: parsed.bytes,
    });

    if (!uploaded.ok) {
      return uploaded;
    }

    return ok({
      locator: uploaded.value.locator,
      rootHashHint: uploaded.value.rootHash,
    });
  }
}
