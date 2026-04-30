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
});
