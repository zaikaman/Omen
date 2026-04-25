import { err, ok, type Result } from "@omen/shared";
import { z } from "zod";

export const zeroGStorageConfigSchema = z.object({
  indexerUrl: z.string().url(),
  kvRpcUrl: z.string().url().optional(),
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

export class ZeroGStorageAdapter {
  private readonly config: ZeroGStorageConfig;

  constructor(config: z.input<typeof zeroGStorageConfigSchema>) {
    this.config = zeroGStorageConfigSchema.parse(config);
  }

  async putValue(
    input: z.input<typeof zeroGStoragePutSchema>,
  ): Promise<Result<{ locator: string; key: string }, Error>> {
    const parsed = zeroGStoragePutSchema.parse(input);

    return ok({
      locator: this.buildKvLocator(parsed.key),
      key: parsed.key,
    });
  }

  async getValue(key: string): Promise<Result<ZeroGStorageValue | null, Error>> {
    if (!key.trim()) {
      return err(new Error("0G KV key is required."));
    }

    return ok(null);
  }

  async uploadFile(
    input: z.input<typeof zeroGFileUploadSchema>,
  ): Promise<Result<{ locator: string; rootHashHint: string }, Error>> {
    const parsed = zeroGFileUploadSchema.parse(input);

    return ok({
      locator: `${this.config.indexerUrl.replace(/\/$/, "")}/files/${encodeURIComponent(parsed.fileName)}`,
      rootHashHint: `${parsed.fileName}:${parsed.bytes.byteLength.toString()}`,
    });
  }

  private buildKvLocator(key: string) {
    const base = this.config.kvRpcUrl ?? this.config.indexerUrl;
    return `${base.replace(/\/$/, "")}/kv/${encodeURIComponent(key)}`;
  }
}
