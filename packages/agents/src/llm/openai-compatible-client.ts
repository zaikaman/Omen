import { z } from "zod";

const openAiCompatibleResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.union([
            z.string(),
            z.array(
              z.object({
                type: z.string().optional(),
                text: z.string().optional(),
              }),
            ),
          ]),
        }),
      }),
    )
    .min(1),
});

const geminiContentResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z
            .array(
              z.object({
                text: z.string().optional(),
              }),
            )
            .default([]),
        }),
      }),
    )
    .min(1),
});

export const openAiCompatibleClientConfigSchema = z.object({
  apiKey: z.string().min(1),
  baseUrl: z.string().url(),
  model: z.string().min(1),
  timeoutMs: z.number().int().min(1000).default(300_000),
  disableTimeout: z.boolean().optional().default(false),
});

export type OpenAiCompatibleClientConfig = z.infer<
  typeof openAiCompatibleClientConfigSchema
>;

const ensureTrailingSlashRemoved = (value: string) => value.replace(/\/+$/, "");

const parseTimeoutMs = (value: string | undefined, defaultValue: number) => {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 1000 ? parsed : defaultValue;
};

const parseModelFallbackEnabled = (value: string | undefined) =>
  value !== "0" && value !== "false";

export const buildTemperaturePayload = (
  model: string,
  temperature: number | undefined,
) => {
  if (model.toLowerCase().startsWith("gpt-5")) {
    return {};
  }

  return { temperature: temperature ?? 0.2 };
};

const extractMessageText = (
  content: z.infer<typeof openAiCompatibleResponseSchema>["choices"][number]["message"]["content"],
) => {
  if (typeof content === "string") {
    return content;
  }

  return content
    .map((part) => part.text?.trim() ?? "")
    .filter((part) => part.length > 0)
    .join("\n");
};

const extractJsonString = (content: string) => {
  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);

  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const objectStart = content.indexOf("{");
  const objectEnd = content.lastIndexOf("}");

  if (objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart) {
    return content.slice(objectStart, objectEnd + 1);
  }

  throw new Error("The model response did not contain a parseable JSON object.");
};

const extractGeminiMessageText = (
  content: z.infer<typeof geminiContentResponseSchema>["candidates"][number]["content"],
) =>
  content.parts
    .map((part) => part.text?.trim() ?? "")
    .filter((part) => part.length > 0)
    .join("\n");

const rawLlmLoggingEnabled = () =>
  process.env.OMEN_LLM_RAW_LOG === "1" || process.env.OMEN_LLM_RAW_LOG === "full";

const logRawLlmPayload = (label: string, payload: unknown) => {
  if (!rawLlmLoggingEnabled()) {
    return;
  }

  console.log(`[omen-llm-raw] ${label} ${JSON.stringify(payload)}`);
};

const MAX_JSON_COMPLETION_REPAIR_ATTEMPTS = 5;
const MAX_JSON_COMPLETION_CLEAN_RESTART_ATTEMPTS = 3;
const MAX_JSON_COMPLETION_ATTEMPTS =
  MAX_JSON_COMPLETION_REPAIR_ATTEMPTS + MAX_JSON_COMPLETION_CLEAN_RESTART_ATTEMPTS;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

class GeminiProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiProviderError";
  }
}

const isGeminiProviderFailure = (error: unknown) =>
  error instanceof GeminiProviderError || error instanceof TypeError;

const isSchemaLikeError = (message: string) =>
  /schema|validation|parse|zod|invalid_type|too_small|too_big|required|expected/i.test(message);

const buildRetryUserPrompt = (input: {
  originalPrompt: string;
  attempt: number;
  error: unknown;
}) => {
  const errorMessage = getErrorMessage(input.error);

  if (isSchemaLikeError(errorMessage)) {
    return [
      input.originalPrompt,
      "",
      `PREVIOUS ATTEMPT ${input.attempt.toString()} FAILED DUE TO SCHEMA VALIDATION ERROR.`,
      "",
      `Error: ${errorMessage}`,
      "",
      "CRITICAL INSTRUCTIONS TO FIX:",
      "1. Return valid JSON that exactly matches the requested output schema.",
      "2. Field types must match exactly. Strings must be strings, arrays must be arrays, objects must be objects.",
      "3. Do not include empty strings for required non-empty string fields.",
      "4. Do not include conversational text, markdown wrappers, explanations, or the error message itself.",
      "5. Return only the corrected JSON object.",
    ].join("\n");
  }

  return [
    input.originalPrompt,
    "",
    `PREVIOUS ATTEMPT ${input.attempt.toString()} FAILED.`,
    `Error: ${errorMessage}`,
    "Retry and return only valid JSON matching the requested schema.",
  ].join("\n");
};

export type JsonCompletionInput<T> = {
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  temperature?: number;
};

export class OpenAiCompatibleJsonClient {
  readonly config: OpenAiCompatibleClientConfig;

  constructor(config: z.input<typeof openAiCompatibleClientConfigSchema>) {
    this.config = openAiCompatibleClientConfigSchema.parse(config);
  }

  static fromEnv(
    role: "reasoning" | "scanner",
    env: NodeJS.ProcessEnv = process.env,
  ) {
    const apiKey =
      role === "scanner"
        ? env.SCANNER_API_KEY ?? env.OPENAI_API_KEY
        : env.OPENAI_API_KEY;
    const baseUrl =
      role === "scanner"
        ? env.SCANNER_BASE_URL ?? env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"
        : env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
    const model =
      role === "scanner"
        ? env.SCANNER_MODEL ?? env.OPENAI_MODEL
        : env.OPENAI_MODEL;

    if (!apiKey || !model) {
      return null;
    }

    const fallback = new OpenAiCompatibleJsonClient({
      apiKey,
      baseUrl,
      model,
      timeoutMs:
        role === "scanner"
          ? parseTimeoutMs(env.SCANNER_TIMEOUT_MS ?? env.OPENAI_TIMEOUT_MS, 300_000)
          : parseTimeoutMs(env.OPENAI_TIMEOUT_MS, 300_000),
    });

    if (
      role === "reasoning" &&
      env.SCANNER_API_KEY &&
      parseModelFallbackEnabled(env.GEMINI_REASONING_ENABLED)
    ) {
      return new GeminiFirstJsonClient({
        primary: new GeminiContentJsonClient({
          apiKey: env.SCANNER_API_KEY,
          baseUrl: env.GEMINI_BASE_URL ?? "https://v98store.com/v1beta",
          model: env.GEMINI_REASONING_MODEL ?? "gemini-3.1-flash-lite-preview",
          disableTimeout: true,
        }),
        fallback,
      });
    }

    return fallback;
  }

  async completeJson<T>(input: JsonCompletionInput<T>) {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= MAX_JSON_COMPLETION_ATTEMPTS; attempt += 1) {
      const isFirstAttempt = attempt === 1;
      const isCleanRestartAttempt = attempt > MAX_JSON_COMPLETION_REPAIR_ATTEMPTS;

      try {
        return await this.completeJsonAttempt({
          ...input,
          userPrompt:
            isFirstAttempt || isCleanRestartAttempt
              ? input.userPrompt
              : buildRetryUserPrompt({
                  originalPrompt: input.userPrompt,
                  attempt: attempt - 1,
                  error: lastError,
                }),
        });
      } catch (error) {
        lastError = error;

        if (attempt >= MAX_JSON_COMPLETION_ATTEMPTS) {
          throw error;
        }

        console.warn("[omen-llm] JSON completion failed; retrying.", {
          model: this.config.model,
          attempt,
          maxAttempts: MAX_JSON_COMPLETION_ATTEMPTS,
          nextAttemptMode:
            attempt >= MAX_JSON_COMPLETION_REPAIR_ATTEMPTS ? "clean_restart" : "error_context",
          error: getErrorMessage(error),
        });
      }
    }

    throw lastError instanceof Error ? lastError : new Error("JSON completion failed.");
  }

  private async completeJsonAttempt<T>(input: JsonCompletionInput<T>) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      logRawLlmPayload("request", {
        model: this.config.model,
        baseUrl: this.config.baseUrl,
        systemPrompt: input.systemPrompt,
        userPrompt: input.userPrompt,
      });

      const response = await fetch(
        `${ensureTrailingSlashRemoved(this.config.baseUrl)}/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            ...buildTemperaturePayload(this.config.model, input.temperature),
            messages: [
              {
                role: "system",
                content: `${input.systemPrompt}\nReturn valid JSON only.`,
              },
              {
                role: "user",
                content: input.userPrompt,
              },
            ],
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `OpenAI-compatible request failed with ${response.status.toString()}: ${errorBody}`,
        );
      }

      const payload = openAiCompatibleResponseSchema.parse(await response.json());
      const rawMessage = extractMessageText(payload.choices[0].message.content);
      logRawLlmPayload("raw-response", {
        model: this.config.model,
        rawMessage,
      });
      const json = JSON.parse(extractJsonString(rawMessage));

      logRawLlmPayload("response", {
        model: this.config.model,
        rawMessage,
        parsedJson: json,
      });

      return input.schema.parse(json);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class GeminiContentJsonClient {
  readonly config: OpenAiCompatibleClientConfig;

  constructor(config: z.input<typeof openAiCompatibleClientConfigSchema>) {
    this.config = openAiCompatibleClientConfigSchema.parse(config);
  }

  async completeJson<T>(input: JsonCompletionInput<T>) {
    const controller = this.config.disableTimeout ? null : new AbortController();
    const timeout =
      controller === null
        ? null
        : setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      logRawLlmPayload("gemini-request", {
        model: this.config.model,
        baseUrl: this.config.baseUrl,
        systemPrompt: input.systemPrompt,
        userPrompt: input.userPrompt,
      });

      const response = await fetch(
        `${ensureTrailingSlashRemoved(this.config.baseUrl)}/models/${encodeURIComponent(
          this.config.model,
        )}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text: `${input.systemPrompt}\nReturn valid JSON only.`,
                },
              ],
            },
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: input.userPrompt,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: input.temperature ?? 0,
              topP: 1,
            },
          }),
          signal: controller?.signal,
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new GeminiProviderError(
          `Gemini request failed with ${response.status.toString()}: ${errorBody}`,
        );
      }

      const payload = geminiContentResponseSchema.parse(await response.json());
      const rawMessage = extractGeminiMessageText(payload.candidates[0].content);
      logRawLlmPayload("gemini-raw-response", {
        model: this.config.model,
        rawMessage,
      });
      const json = JSON.parse(extractJsonString(rawMessage));

      logRawLlmPayload("gemini-response", {
        model: this.config.model,
        rawMessage,
        parsedJson: json,
      });

      return input.schema.parse(json);
    } finally {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
    }
  }
}

export class GeminiFirstJsonClient extends OpenAiCompatibleJsonClient {
  constructor(
    private readonly input: {
      primary: GeminiContentJsonClient;
      fallback: OpenAiCompatibleJsonClient;
    },
  ) {
    super(input.fallback.config);
  }

  override async completeJson<T>(input: JsonCompletionInput<T>) {
    try {
      return await this.input.primary.completeJson(input);
    } catch (error) {
      if (!isGeminiProviderFailure(error)) {
        throw error;
      }

      console.warn("[omen-llm] Gemini reasoning request failed; falling back to GPT.", {
        geminiModel: this.input.primary.config.model,
        fallbackModel: this.input.fallback.config.model,
        error: getErrorMessage(error),
      });
      return this.input.fallback.completeJson(input);
    }
  }
}
