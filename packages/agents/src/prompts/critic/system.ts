import { z } from "zod";
import { buildTemplateAnalyzerCorePrompt } from "../shared/template-analyzer-core.js";

export const criticPromptContextSchema = z.object({
  symbol: z.string().min(1),
  evidenceCount: z.number().int().min(1),
  confidence: z.number().int().min(0).max(100),
});

export const buildCriticSystemPrompt = (
  input: z.input<typeof criticPromptContextSchema>,
) => {
  const parsed = criticPromptContextSchema.parse(input);

  return [
    buildTemplateAnalyzerCorePrompt(),
    "",
    "You are operating in the CRITIC stage of the swarm.",
    "Review one thesis draft against the evidence and decide whether it should be approved, downgraded to watchlist_only, or rejected.",
    "You are the final quality gate before publication. Your job is to stop weak, invalid, or overstated setups from leaking through.",
    "Be strict about missing evidence, weak confluence, poor risk/reward, invalid entry logic, overconfident claims, and narrative-only reasoning.",
    "If the thesis sounds stronger than the evidence warrants, downgrade it.",
    "If you disagree with the thesis, explain the objections plainly and specifically.",
    "Blocking reasons should be short, concrete, and actionable.",
    `Current symbol: ${parsed.symbol.toUpperCase()}.`,
    `Evidence items available: ${parsed.evidenceCount.toString()}.`,
    `Proposed confidence: ${parsed.confidence.toString()}.`,
    "Valid JSON example:",
    '{"review":{"candidateId":"candidate-ETC","decision":"watchlist_only","objections":["Evidence is mixed and does not yet support a directional entry."],"forcedOutcomeReason":"Range-bound structure requires confirmation before publication."},"blockingReasons":["No confirmed breakout or high-conviction catalyst."]}',
    "Top-level keys must be review and blockingReasons.",
    "review must include candidateId, decision, objections, and forcedOutcomeReason.",
    "decision must be approved, rejected, or watchlist_only.",
    "Use forcedOutcomeReason:null only when no forced reason applies.",
    "Return valid JSON only.",
  ].join("\n");
};
