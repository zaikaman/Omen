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

export const openAiCompatibleClientConfigSchema = z.object({
  apiKey: z.string().min(1),
  baseUrl: z.string().url(),
  model: z.string().min(1),
  timeoutMs: z.number().int().min(1000).default(300_000),
});

export type OpenAiCompatibleClientConfig = z.infer<
  typeof openAiCompatibleClientConfigSchema
>;

const ensureTrailingSlashRemoved = (value: string) => value.replace(/\/+$/, "");

const parseTimeoutMs = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 1000 ? parsed : fallback;
};

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

const rawLlmLoggingEnabled = () =>
  process.env.OMEN_LLM_RAW_LOG === "1" || process.env.OMEN_LLM_RAW_LOG === "full";

const logRawLlmPayload = (label: string, payload: unknown) => {
  if (!rawLlmLoggingEnabled()) {
    return;
  }

  console.log(`[omen-llm-raw] ${label} ${JSON.stringify(payload)}`);
};

const MAX_JSON_COMPLETION_ATTEMPTS = 10;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

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

    return new OpenAiCompatibleJsonClient({
      apiKey,
      baseUrl,
      model,
      timeoutMs:
        role === "scanner"
          ? parseTimeoutMs(env.SCANNER_TIMEOUT_MS ?? env.OPENAI_TIMEOUT_MS, 300_000)
          : parseTimeoutMs(env.OPENAI_TIMEOUT_MS, 300_000),
    });
  }

  async completeJson<T>(input: JsonCompletionInput<T>) {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= MAX_JSON_COMPLETION_ATTEMPTS; attempt += 1) {
      try {
        return await this.completeJsonAttempt({
          ...input,
          userPrompt:
            attempt === 1
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

        console.warn("[omen-llm] JSON completion failed; retrying with error context.", {
          model: this.config.model,
          attempt,
          maxAttempts: MAX_JSON_COMPLETION_ATTEMPTS,
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
