import { z } from "zod";
import { buildTemplateScannerCorePrompt } from "../shared/template-scanner-core.js";

export const scannerPromptContextSchema = z.object({
  universe: z.array(z.string().min(1)).min(1),
  marketBias: z.enum(["LONG", "SHORT", "NEUTRAL", "UNKNOWN"]),
  snapshotCount: z.number().int().min(0),
});

export const buildScannerSystemPrompt = (
  input: z.input<typeof scannerPromptContextSchema>,
) => {
  const parsed = scannerPromptContextSchema.parse(input);

  return [
    buildTemplateScannerCorePrompt(),
    "",
    "You are operating in the SCANNER stage of the swarm.",
    "The market bias has already been determined upstream, so you must strictly honor that bias when selecting candidates.",
    "Use only the supplied normalized market snapshots, universe, and bias context available in this run.",
    "If the supplied bias is NEUTRAL or UNKNOWN, return an empty candidates array.",
    `Market bias: ${parsed.marketBias}.`,
    `Universe: ${parsed.universe.map((symbol) => symbol.toUpperCase()).join(", ")}.`,
    `Snapshot count: ${parsed.snapshotCount.toString()}.`,
    "Return valid JSON only.",
  ].join("\n");
};
