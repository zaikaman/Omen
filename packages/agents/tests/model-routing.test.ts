import { describe, expect, it } from "vitest";

import { buildTemperaturePayload } from "../src/llm/openai-compatible-client.js";
import { resolveModelProfileForRole } from "../src/index.js";

describe("model routing", () => {
  it("routes discovery and research roles to the scanner profile", () => {
    expect(resolveModelProfileForRole("market_bias")).toBe("scanner");
    expect(resolveModelProfileForRole("scanner")).toBe("scanner");
    expect(resolveModelProfileForRole("research")).toBe("scanner");
    expect(resolveModelProfileForRole("intel")).toBe("scanner");
  });

  it("routes thesis, review, and publishing roles to the reasoning profile", () => {
    expect(resolveModelProfileForRole("chart_vision")).toBe("reasoning");
    expect(resolveModelProfileForRole("analyst")).toBe("reasoning");
    expect(resolveModelProfileForRole("critic")).toBe("reasoning");
    expect(resolveModelProfileForRole("publisher")).toBe("reasoning");
    expect(resolveModelProfileForRole("generator")).toBe("reasoning");
    expect(resolveModelProfileForRole("writer")).toBe("reasoning");
  });

  it("omits custom temperature for GPT-5 models", () => {
    expect(buildTemperaturePayload("gpt-5-nano", 0.2)).toEqual({});
    expect(buildTemperaturePayload("grok-4-fast", 0.2)).toEqual({
      temperature: 0.2,
    });
  });
});
