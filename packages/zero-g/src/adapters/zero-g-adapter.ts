import { proofArtifactSchema, type ProofArtifact } from "@omen/shared";
import { z } from "zod";

import {
  ZeroGChainAdapter,
  zeroGChainConfigSchema,
  type ZeroGChainProof,
} from "../chain/chain-adapter.js";
import {
  ZeroGComputeAdapter,
  zeroGComputeConfigSchema,
  type ZeroGComputeRequest,
  type ZeroGComputeResult,
} from "../compute/compute-adapter.js";
import {
  ZeroGLogAdapter,
  zeroGLogConfigSchema,
  type ZeroGLogAppendInput,
} from "../storage/log-adapter.js";
import {
  ZeroGStorageAdapter,
  zeroGStorageConfigSchema,
  type ZeroGFileUploadInput,
  type ZeroGStoragePutInput,
  type ZeroGStorageValue,
} from "../storage/storage-adapter.js";
import { err, ok, type Result } from "@omen/shared";

export const zeroGAdapterConfigSchema = z.object({
  storage: zeroGStorageConfigSchema,
  log: zeroGLogConfigSchema,
  compute: zeroGComputeConfigSchema.optional(),
  chain: zeroGChainConfigSchema.optional(),
});

export interface ZeroGAdapter {
  readonly storage: ZeroGStorageAdapter;
  readonly log: ZeroGLogAdapter;
  readonly compute: ZeroGComputeAdapter | null;
  readonly chain: ZeroGChainAdapter | null;
  putState(input: ZeroGStoragePutInput): Promise<Result<ProofArtifact, Error>>;
  getState(key: string): Promise<Result<ZeroGStorageValue | null, Error>>;
  appendLog(input: ZeroGLogAppendInput): Promise<Result<ProofArtifact, Error>>;
  uploadFile(input: ZeroGFileUploadInput): Promise<Result<ProofArtifact, Error>>;
  requestCompute(input: ZeroGComputeRequest): Promise<Result<ZeroGComputeResult, Error>>;
  anchorManifest(manifestRoot: string): Promise<Result<ZeroGChainProof, Error>>;
}

export class ZeroGClientAdapter implements ZeroGAdapter {
  readonly storage: ZeroGStorageAdapter;

  readonly log: ZeroGLogAdapter;

  readonly compute: ZeroGComputeAdapter | null;

  readonly chain: ZeroGChainAdapter | null;

  constructor(
    config: z.input<typeof zeroGAdapterConfigSchema>,
    overrides?: {
      storage?: ZeroGStorageAdapter;
      log?: ZeroGLogAdapter;
      compute?: ZeroGComputeAdapter | null;
      chain?: ZeroGChainAdapter | null;
    },
  ) {
    const parsed = zeroGAdapterConfigSchema.parse(config);

    this.storage = overrides?.storage ?? new ZeroGStorageAdapter(parsed.storage);
    this.log = overrides?.log ?? new ZeroGLogAdapter(parsed.log);
    this.compute =
      overrides?.compute ?? (parsed.compute ? new ZeroGComputeAdapter(parsed.compute) : null);
    this.chain =
      overrides?.chain ?? (parsed.chain ? new ZeroGChainAdapter(parsed.chain) : null);
  }

  async putState(input: ZeroGStoragePutInput) {
    const stored = await this.storage.putValue(input);

    if (!stored.ok) {
      return stored;
    }

    return ok(
      proofArtifactSchema.parse({
        id: `${input.key}:kv`,
        runId: "unbound",
        signalId: null,
        intelId: null,
        refType: "kv_state",
        key: input.key,
        locator: stored.value.locator,
        metadata: input.metadata,
        compute: null,
        createdAt: new Date().toISOString(),
      }),
    );
  }

  async getState(key: string) {
    return this.storage.getValue(key);
  }

  async appendLog(input: ZeroGLogAppendInput) {
    const appended = await this.log.append(input);

    if (!appended.ok) {
      return appended;
    }

    return ok(
      proofArtifactSchema.parse({
        id: `${input.stream}:log`,
        runId: "unbound",
        signalId: null,
        intelId: null,
        refType: "log_entry",
        key: input.stream,
        locator: appended.value.locator,
        metadata: appended.value.metadata,
        compute: null,
        createdAt: new Date().toISOString(),
      }),
    );
  }

  async uploadFile(input: ZeroGFileUploadInput) {
    const uploaded = await this.storage.uploadFile(input);

    if (!uploaded.ok) {
      return uploaded;
    }

    return ok(
      proofArtifactSchema.parse({
        id: `${input.fileName}:file`,
        runId: "unbound",
        signalId: null,
        intelId: null,
        refType: "file_artifact",
        key: input.fileName,
        locator: uploaded.value.locator,
        metadata: {
          rootHashHint: uploaded.value.rootHashHint,
          contentType: input.contentType,
          ...input.metadata,
        },
        compute: null,
        createdAt: new Date().toISOString(),
      }),
    );
  }

  async requestCompute(input: ZeroGComputeRequest) {
    if (!this.compute) {
      return err(new Error("0G compute adapter is not configured."));
    }

    return this.compute.requestInference(input);
  }

  async anchorManifest(manifestRoot: string) {
    if (!this.chain) {
      return err(new Error("0G chain adapter is not configured."));
    }

    return this.chain.createProofAnchor(manifestRoot);
  }
}

export type ZeroGAdapterConfig = z.infer<typeof zeroGAdapterConfigSchema>;
