import { ok, type Result } from "@omen/shared";
import { z } from "zod";

import { ZeroGSdkClient } from "../internal/sdk-client.js";

export const zeroGLogConfigSchema = z.object({
  baseUrl: z.string().url(),
  evmRpcUrl: z.string().url().optional(),
  privateKey: z.string().min(1).optional(),
  expectedReplica: z.number().int().min(1).default(1),
  requestTimeoutMs: z.number().int().min(1).default(10_000),
});

export const zeroGLogAppendSchema = z.object({
  stream: z.string().min(1),
  content: z.union([z.string(), z.instanceof(Uint8Array)]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const zeroGLogEntrySchema = z.object({
  stream: z.string().min(1),
  locator: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type ZeroGLogConfig = z.infer<typeof zeroGLogConfigSchema>;
export type ZeroGLogAppendInput = z.infer<typeof zeroGLogAppendSchema>;
export type ZeroGLogEntry = z.infer<typeof zeroGLogEntrySchema>;

type ZeroGLogSdkBridge = {
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

export class ZeroGLogAdapter {
  private readonly config: ZeroGLogConfig;

  private readonly bridge: ZeroGLogSdkBridge;

  constructor(
    config: z.input<typeof zeroGLogConfigSchema>,
    bridge?: ZeroGLogSdkBridge,
  ) {
    this.config = zeroGLogConfigSchema.parse(config);
    this.bridge =
      bridge ??
      new ZeroGSdkClient({
        indexerUrl: this.config.baseUrl,
        blockchainRpcUrl: this.config.evmRpcUrl ?? null,
        privateKey: this.config.privateKey ?? null,
        expectedReplica: this.config.expectedReplica,
        requestTimeoutMs: this.config.requestTimeoutMs,
      });
  }

  async append(
    input: z.input<typeof zeroGLogAppendSchema>,
  ): Promise<Result<ZeroGLogEntry, Error>> {
    const parsed = zeroGLogAppendSchema.parse(input);
    const content =
      typeof parsed.content === "string"
        ? new TextEncoder().encode(parsed.content)
        : parsed.content;
    const contentHash = await this.createContentHash(content);
    const uploaded = await this.bridge.uploadObject({
      logicalName: `${parsed.stream}/${Date.now().toString()}-${contentHash}.log`,
      bytes: content,
    });

    if (!uploaded.ok) {
      return uploaded;
    }

    return ok({
      stream: parsed.stream,
      locator: uploaded.value.locator,
      metadata: {
        ...parsed.metadata,
        rootHash: uploaded.value.rootHash,
        rootHashes: uploaded.value.rootHashes,
        txHash: uploaded.value.txHash,
        txSeq: uploaded.value.txSeq,
      },
    });
  }

  private async createContentHash(content: Uint8Array) {
    const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(content));

    return Buffer.from(digest).toString("hex").slice(0, 16);
  }
}
