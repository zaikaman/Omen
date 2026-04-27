import { OMEN_DISCLAIMER, type Intel } from "@omen/shared";

const POST_LIMIT = 280;

const trimPost = (value: string) => {
  const normalized = value.replace(/\s+\n/g, "\n").trim();

  if (normalized.length <= POST_LIMIT) {
    return normalized;
  }

  return `${normalized.slice(0, POST_LIMIT - 3).trimEnd()}...`;
};

export const buildIntelThreadParts = (
  intel: Pick<Intel, "title" | "summary" | "body" | "symbols" | "confidence">,
) => {
  const symbolLine =
    intel.symbols.length > 0 ? `Watch: ${intel.symbols.join(" / ")}` : "Watch: market structure";
  const paragraphs = intel.body
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  return [
    `${intel.title}\n\n${intel.summary}`,
    `${symbolLine}\nConfidence: ${intel.confidence}%`,
    ...paragraphs.slice(0, 3),
    OMEN_DISCLAIMER,
  ].map(trimPost);
};
