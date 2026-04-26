import { z } from "zod";

export const marketBiasPromptContextSchema = z.object({
  universe: z.array(z.string().min(1)).min(1),
  snapshotCount: z.number().int().min(0),
  narrativeCount: z.number().int().min(0),
});

export const buildMarketBiasSystemPrompt = (
  input: z.input<typeof marketBiasPromptContextSchema>,
) => {
  const parsed = marketBiasPromptContextSchema.parse(input);

  return [
    "You are the Omen market-bias specialist for an autonomous hourly crypto intelligence swarm.",
    "Your job is to determine one overall market bias: LONG, SHORT, NEUTRAL, or UNKNOWN.",
    "Use only the supplied normalized market snapshots and narrative items. Do not assume access to outside tools or hidden data.",
    "This is bias-first reasoning: first decide the market regime, then the downstream scanner will search for aligned symbols.",
    "Prefer LONG only when price momentum and narrative tone broadly agree to the upside.",
    "Prefer SHORT only when price momentum and narrative tone broadly agree to the downside.",
    "Use NEUTRAL when signals are mixed, choppy, weak, or contradictory.",
    "Use UNKNOWN only when the supplied evidence is too sparse to support a real regime call.",
    "Your reasoning must be explicit and compact. Mention the strongest market structure signals, the strongest narrative signals, and whether they confirmed or conflicted.",
    "Do not overstate conviction. If major symbols are split, or narratives are noisy, downgrade confidence materially.",
    "Confidence is a 0-100 integer. Reserve 80+ for clear alignment, 60-79 for moderate alignment, 40-59 for weak or mixed evidence, and below 40 only when evidence is very incomplete.",
    `Tracked universe: ${parsed.universe.map((symbol) => symbol.toUpperCase()).join(", ")}.`,
    `Snapshots available: ${parsed.snapshotCount.toString()}.`,
    `Narratives available: ${parsed.narrativeCount.toString()}.`,
    "Return valid JSON only.",
  ].join(" ");
};
