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
      const response = await fetch(this.buildInferenceUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: parsed.model,
          messages: [
            {
              role: "system",
              content:
                "You are the 0G Compute reasoning engine. Return a concise, directly usable result.",
            },
            {
              role: "user",
              content: parsed.prompt,
            },
          ],
          metadata: parsed.metadata,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const responseBody = await response.text().catch(() => "");
        const responseDetail = responseBody.trim()
          ? `: ${responseBody.trim().slice(0, 500)}`
          : "";

        return err(
          new Error(
            `0G compute request failed with HTTP ${response.status.toString()}${responseDetail}`,
          ),
        );
      }

      const payload = (await response.json()) as Record<string, unknown>;
      const choices = Array.isArray(payload.choices)
        ? payload.choices
        : null;
      const firstChoice =
        choices && choices.length > 0 && typeof choices[0] === "object" && choices[0]
          ? (choices[0] as Record<string, unknown>)
          : null;
      const firstMessage =
        firstChoice &&
        typeof firstChoice.message === "object" &&
        firstChoice.message
          ? (firstChoice.message as Record<string, unknown>)
          : null;
      const content =
        typeof firstMessage?.content === "string"
          ? firstMessage.content
          : typeof payload.output === "string"
            ? payload.output
            : typeof payload.text === "string"
              ? payload.text
              : JSON.stringify(payload);
      const jobId =
        response.headers.get("ZG-Res-Key") ??
        (typeof payload.id === "string"
          ? payload.id
          : typeof payload.jobId === "string"
            ? payload.jobId
            : `job-${Date.now().toString()}`);
      const verificationMode =
        response.headers.get("ZG-TEE-Mode") ??
        (typeof payload.verificationMode === "string"
          ? payload.verificationMode
          : null);

      return ok(
        zeroGComputeResultSchema.parse({
          jobId,
          provider: "0g-compute",
          model: parsed.model,
          output: content,
          verificationMode,
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

  private buildInferenceUrl() {
    const base = this.config.baseUrl.replace(/\/$/, "");

    if (base.endsWith("/chat/completions")) {
      return base;
    }

    if (base.endsWith("/v1/proxy")) {
      return `${base}/chat/completions`;
    }

    return `${base}/v1/proxy/chat/completions`;
  }
}
