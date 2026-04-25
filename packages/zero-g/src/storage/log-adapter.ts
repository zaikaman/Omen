import { ok, type Result } from "@omen/shared";
import { z } from "zod";

export const zeroGLogConfigSchema = z.object({
  baseUrl: z.string().url(),
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

export class ZeroGLogAdapter {
  private readonly config: ZeroGLogConfig;

  constructor(config: z.input<typeof zeroGLogConfigSchema>) {
    this.config = zeroGLogConfigSchema.parse(config);
  }

  async append(
    input: z.input<typeof zeroGLogAppendSchema>,
  ): Promise<Result<ZeroGLogEntry, Error>> {
    const parsed = zeroGLogAppendSchema.parse(input);

    return ok({
      stream: parsed.stream,
      locator: `${this.config.baseUrl.replace(/\/$/, "")}/log/${encodeURIComponent(parsed.stream)}`,
      metadata: parsed.metadata,
    });
  }
}
