import { err, ok, type Result } from "@omen/shared";
import { z } from "zod";

export const zeroGComputeConfigSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1).optional(),
  requestTimeoutMs: z.number().int().min(1).default(20_000),
});

export const zeroGComputeRequestSchema = z.object({
  model: z.string().min(1),
  prompt: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const zeroGComputeResultSchema = z.object({
  jobId: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  output: z.string().min(1),
  verificationMode: z.string().min(1).nullable(),
  requestHash: z.string().min(1).nullable(),
  responseHash: z.string().min(1).nullable(),
});

export type ZeroGComputeConfig = z.infer<typeof zeroGComputeConfigSchema>;
export type ZeroGComputeRequest = z.infer<typeof zeroGComputeRequestSchema>;
export type ZeroGComputeResult = z.infer<typeof zeroGComputeResultSchema>;

export class ZeroGComputeAdapter {
  private readonly config: ZeroGComputeConfig;

  constructor(config: z.input<typeof zeroGComputeConfigSchema>) {
    this.config = zeroGComputeConfigSchema.parse(config);
  }

  async requestInference(
    input: z.input<typeof zeroGComputeRequestSchema>,
  ): Promise<Result<ZeroGComputeResult, Error>> {
    const parsed = zeroGComputeRequestSchema.parse(input);
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.config.requestTimeoutMs);

    try {
      const response = await fetch(this.config.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: parsed.model,
          prompt: parsed.prompt,
          metadata: parsed.metadata,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        return err(
          new Error(`0G compute request failed with HTTP ${response.status.toString()}.`),
        );
      }

      const payload = (await response.json()) as Record<string, unknown>;

      return ok(
        zeroGComputeResultSchema.parse({
          jobId:
            typeof payload.id === "string"
              ? payload.id
              : typeof payload.jobId === "string"
                ? payload.jobId
                : `job-${Date.now().toString()}`,
          provider: "0g-compute",
          model: parsed.model,
          output:
            typeof payload.output === "string"
              ? payload.output
              : typeof payload.text === "string"
                ? payload.text
                : JSON.stringify(payload),
          verificationMode:
            typeof payload.verificationMode === "string"
              ? payload.verificationMode
              : null,
          requestHash:
            typeof payload.requestHash === "string" ? payload.requestHash : null,
          responseHash:
            typeof payload.responseHash === "string" ? payload.responseHash : null,
        }),
      );
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("0G compute request failed."),
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
