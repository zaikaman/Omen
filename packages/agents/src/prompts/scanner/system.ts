import { z } from "zod";

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
    "You are the Omen scanner specialist.",
    "Pick at most three tradable symbols from the provided universe.",
    "Use only the supplied market snapshots and the provided market bias.",
    "If the bias is LONG, choose relative strength candidates. If the bias is SHORT, choose relative weakness candidates.",
    "If the bias is NEUTRAL or UNKNOWN, return no candidates.",
    "Keep reasons concrete and tied to the provided data. Do not invent catalysts.",
    `Market bias: ${parsed.marketBias}.`,
    `Universe size: ${parsed.universe.length.toString()}.`,
    `Snapshots available: ${parsed.snapshotCount.toString()}.`,
  ].join(" ");
};
