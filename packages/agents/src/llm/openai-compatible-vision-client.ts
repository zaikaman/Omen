import { z } from "zod";

import {
  openAiCompatibleClientConfigSchema,
  type OpenAiCompatibleClientConfig,
} from "./openai-compatible-client.js";

const openAiCompatibleVisionResponseSchema = z.object({
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

const openAiCompatibleVisionImageSchema = z.object({
  base64: z.string().min(1),
  mimeType: z.string().min(1).default("image/png"),
});

const ensureTrailingSlashRemoved = (value: string) => value.replace(/\/+$/, "");

const extractMessageText = (
  content: z.infer<typeof openAiCompatibleVisionResponseSchema>["choices"][number]["message"]["content"],
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

export type VisionJsonCompletionInput<T> = {
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
  images: Array<z.input<typeof openAiCompatibleVisionImageSchema>>;
  temperature?: number;
};

export class OpenAiCompatibleVisionClient {
  readonly config: OpenAiCompatibleClientConfig;

  constructor(config: z.input<typeof openAiCompatibleClientConfigSchema>) {
    this.config = openAiCompatibleClientConfigSchema.parse(config);
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env) {
    const apiKey = env.SCANNER_API_KEY ?? env.OPENAI_API_KEY;
    const baseUrl = env.SCANNER_BASE_URL ?? env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
    const model = env.SCANNER_MODEL ?? env.OPENAI_MODEL;

    if (!apiKey || !model) {
      return null;
    }

    return new OpenAiCompatibleVisionClient({
      apiKey,
      baseUrl,
      model,
    });
  }

  async completeJson<T>(input: VisionJsonCompletionInput<T>) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const images = input.images.map((image) =>
        openAiCompatibleVisionImageSchema.parse(image),
      );
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
            temperature: input.temperature ?? 0.2,
            messages: [
              {
                role: "system",
                content: `${input.systemPrompt}\nReturn valid JSON only.`,
              },
              {
                role: "user",
                content: [
                  { type: "text", text: input.userPrompt },
                  ...images.map((image) => ({
                    type: "image_url",
                    image_url: {
                      url: `data:${image.mimeType};base64,${image.base64}`,
                    },
                  })),
                ],
              },
            ],
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `OpenAI-compatible vision request failed with ${response.status.toString()}: ${errorBody}`,
        );
      }

      const payload = openAiCompatibleVisionResponseSchema.parse(await response.json());
      const rawMessage = extractMessageText(payload.choices[0].message.content);
      const json = JSON.parse(extractJsonString(rawMessage));

      return input.schema.parse(json);
    } finally {
      clearTimeout(timeout);
    }
  }
}
