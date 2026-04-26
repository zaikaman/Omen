import { describe, expect, it } from "vitest";

import { resolveModelProfileForRole } from "../src/index.js";

describe("model routing", () => {
  it("routes discovery and research roles to the scanner profile", () => {
    expect(resolveModelProfileForRole("market_bias")).toBe("scanner");
    expect(resolveModelProfileForRole("scanner")).toBe("scanner");
    expect(resolveModelProfileForRole("research")).toBe("scanner");
  });

  it("routes thesis, review, and publishing roles to the reasoning profile", () => {
    expect(resolveModelProfileForRole("analyst")).toBe("reasoning");
    expect(resolveModelProfileForRole("critic")).toBe("reasoning");
    expect(resolveModelProfileForRole("publisher")).toBe("reasoning");
  });
});
