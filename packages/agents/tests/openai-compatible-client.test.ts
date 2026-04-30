import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { OpenAiCompatibleJsonClient } from "../src/llm/openai-compatible-client.js";

const createJsonResponse = (content: unknown) =>
  new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify(content),
          },
        },
      ],
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    },
  );

const createGeminiJsonResponse = (content: unknown) =>
  new Response(
    JSON.stringify({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify(content),
              },
            ],
          },
        },
      ],
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    },
  );

describe("OpenAiCompatibleJsonClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retries schema failures with the previous error appended to the prompt", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ text: 123 }))
      .mockResolvedValueOnce(createJsonResponse({ text: "fixed" }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new OpenAiCompatibleJsonClient({
      apiKey: "test-key",
      baseUrl: "https://example.com/v1",
      model: "grok-4-fast",
    });
    const result = await client.completeJson({
      schema: z.object({
        text: z.string(),
      }),
      systemPrompt: "Return a text field.",
      userPrompt: "Make a short response.",
    });

    expect(result.text).toBe("fixed");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const retryBody = JSON.parse(fetchMock.mock.calls[1][1].body as string) as {
      messages: Array<{ role: string; content: string }>;
    };
    const retryPrompt = retryBody.messages.find((message) => message.role === "user")?.content;

    expect(retryPrompt).toContain("Make a short response.");
    expect(retryPrompt).toContain("PREVIOUS ATTEMPT 1 FAILED DUE TO SCHEMA VALIDATION ERROR.");
    expect(retryPrompt).toContain("Expected string");
  });

  it("uses clean restarts after five repair attempts", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(createJsonResponse({ text: 123 })));
    vi.stubGlobal("fetch", fetchMock);

    const client = new OpenAiCompatibleJsonClient({
      apiKey: "test-key",
      baseUrl: "https://example.com/v1",
      model: "grok-4-fast",
    });

    await expect(
      client.completeJson({
        schema: z.object({
          text: z.string(),
        }),
        systemPrompt: "Return a text field.",
        userPrompt: "Make a short response.",
      }),
    ).rejects.toThrow("Expected string");

    expect(fetchMock).toHaveBeenCalledTimes(8);

    const repairBody = JSON.parse(fetchMock.mock.calls[4][1].body as string) as {
      messages: Array<{ role: string; content: string }>;
    };
    const firstCleanRestartBody = JSON.parse(fetchMock.mock.calls[5][1].body as string) as {
      messages: Array<{ role: string; content: string }>;
    };
    const finalCleanRestartBody = JSON.parse(fetchMock.mock.calls[7][1].body as string) as {
      messages: Array<{ role: string; content: string }>;
    };
    const repairPrompt = repairBody.messages.find((message) => message.role === "user")?.content;
    const firstCleanRestartPrompt = firstCleanRestartBody.messages.find(
      (message) => message.role === "user",
    )?.content;
    const finalCleanRestartPrompt = finalCleanRestartBody.messages.find(
      (message) => message.role === "user",
    )?.content;

    expect(repairPrompt).toContain("PREVIOUS ATTEMPT 4 FAILED DUE TO SCHEMA VALIDATION ERROR.");
    expect(firstCleanRestartPrompt).toBe("Make a short response.");
    expect(finalCleanRestartPrompt).toBe("Make a short response.");
  });

  it("throws after eight failed attempts", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(createJsonResponse({ text: 123 })));
    vi.stubGlobal("fetch", fetchMock);

    const client = new OpenAiCompatibleJsonClient({
      apiKey: "test-key",
      baseUrl: "https://example.com/v1",
      model: "grok-4-fast",
    });

    await expect(
      client.completeJson({
        schema: z.object({
          text: z.string(),
        }),
        systemPrompt: "Return a text field.",
        userPrompt: "Make a short response.",
      }),
    ).rejects.toThrow("Expected string");
    expect(fetchMock).toHaveBeenCalledTimes(8);
  });

  it("uses Gemini first for reasoning roles when scanner credentials are available", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createGeminiJsonResponse({ text: "gemini" }));
    vi.stubGlobal("fetch", fetchMock);

    const client = OpenAiCompatibleJsonClient.fromEnv("reasoning", {
      OPENAI_API_KEY: "openai-key",
      OPENAI_MODEL: "gpt-5-nano",
      SCANNER_API_KEY: "scanner-key",
    });

    const result = await client?.completeJson({
      schema: z.object({
        text: z.string(),
      }),
      systemPrompt: "Return text.",
      userPrompt: "Say hi.",
    });

    expect(result?.text).toBe("gemini");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://v98store.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent",
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      generationConfig: Record<string, unknown>;
    };
    expect(body.generationConfig).not.toHaveProperty("thinkingConfig");
    expect(body.generationConfig).not.toHaveProperty("responseMimeType");
    expect(fetchMock.mock.calls[0][1].signal).toBeUndefined();
  });

  it("falls back to GPT when Gemini reasoning fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "bad gateway" }), {
          status: 502,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(createJsonResponse({ text: "gpt" }));
    vi.stubGlobal("fetch", fetchMock);

    const client = OpenAiCompatibleJsonClient.fromEnv("reasoning", {
      OPENAI_API_KEY: "openai-key",
      OPENAI_BASE_URL: "https://openai.example/v1",
      OPENAI_MODEL: "gpt-5-nano",
      SCANNER_API_KEY: "scanner-key",
    });

    const result = await client?.completeJson({
      schema: z.object({
        text: z.string(),
      }),
      systemPrompt: "Return text.",
      userPrompt: "Say hi.",
    });

    expect(result?.text).toBe("gpt");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://v98store.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent",
    );
    expect(fetchMock.mock.calls[1][0]).toBe("https://openai.example/v1/chat/completions");
  });

  it("does not fall back to GPT when Gemini returns invalid schema JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createGeminiJsonResponse({ text: 123 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = OpenAiCompatibleJsonClient.fromEnv("reasoning", {
      OPENAI_API_KEY: "openai-key",
      OPENAI_BASE_URL: "https://openai.example/v1",
      OPENAI_MODEL: "gpt-5-nano",
      SCANNER_API_KEY: "scanner-key",
    });

    await expect(
      client?.completeJson({
        schema: z.object({
          text: z.string(),
        }),
        systemPrompt: "Return text.",
        userPrompt: "Say hi.",
      }),
    ).rejects.toThrow("Expected string");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
