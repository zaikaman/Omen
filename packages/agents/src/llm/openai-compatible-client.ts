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
  timeoutMs: z.number().int().min(1000).default(30_000),
});

export type OpenAiCompatibleClientConfig = z.infer<
  typeof openAiCompatibleClientConfigSchema
>;

const ensureTrailingSlashRemoved = (value: string) => value.replace(/\/+$/, "");

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
    });
  }

  async completeJson<T>(input: JsonCompletionInput<T>) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
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
      const json = JSON.parse(extractJsonString(rawMessage));

      return input.schema.parse(json);
    } finally {
      clearTimeout(timeout);
    }
  }
}
