import { z } from "zod";
import { buildTemplateScannerCorePrompt } from "../shared/template-scanner-core.js";

export const scannerPromptContextSchema = z.object({
  universe: z.array(z.string().min(1)).min(1),
  marketBias: z.enum(["LONG", "SHORT", "NEUTRAL", "UNKNOWN"]),
  snapshotCount: z.number().int().min(0),
  blockedSymbols: z.array(z.string().min(1)).default([]),
});

export const buildScannerSystemPrompt = (input: z.input<typeof scannerPromptContextSchema>) => {
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
    parsed.blockedSymbols.length > 0
      ? `Do not select these symbols because they already have active or pending trades: ${parsed.blockedSymbols.map((symbol) => symbol.toUpperCase()).join(", ")}.`
      : "There are no active or pending trade symbols to exclude.",
    "Valid JSON example for NEUTRAL or UNKNOWN bias:",
    '{"marketBias":"NEUTRAL","candidates":[],"rejectedSymbols":["BTC","ETH"]}',
    "Valid JSON example for directional selection:",
    '{"marketBias":"LONG","candidates":[{"id":"candidate-SOL","symbol":"SOL","reason":"SOL is outperforming the supplied universe with stronger market momentum.","directionHint":"LONG","status":"pending","sourceUniverse":"default","dedupeKey":"SOL-long","missingDataNotes":[]}],"rejectedSymbols":["BTC","ETH"]}',
    "Every candidate must include id, symbol, reason, directionHint, status, sourceUniverse, dedupeKey, and missingDataNotes.",
    "status must be pending for new scanner candidates.",
    "Return valid JSON only.",
  ].join("\n");
};
