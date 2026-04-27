import type { z } from "zod";

import { memoryInputSchema, memoryOutputSchema } from "../contracts/memory.js";
import type { RuntimeNodeDefinition } from "../framework/agent-runtime.js";
import type { SwarmState } from "../framework/state.js";

const sanitizeLabel = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const unique = <T>(values: T[]) => Array.from(new Set(values));

export const deriveMemoryCheckpoint = (input: z.input<typeof memoryInputSchema>) => {
  const parsed = memoryInputSchema.parse(input);
  const sanitizedLabel = sanitizeLabel(parsed.checkpointLabel);
  const checkpointRefId =
    sanitizedLabel.length > 0
      ? `checkpoint-${parsed.context.runId}-${sanitizedLabel}`
      : `checkpoint-${parsed.context.runId}`;
  const appendedProofRefs = unique(parsed.proofArtifacts.map((artifact) => artifact.id));
  const noteRefs = parsed.notes.map(
    (note, index) => `note:${index.toString()}:${note.slice(0, 48).trim() || "checkpoint-update"}`,
  );

  return memoryOutputSchema.parse({
    checkpointRefId,
    appendedProofRefs: unique([...appendedProofRefs, ...noteRefs]),
  });
};

export const createMemoryAgent = (): RuntimeNodeDefinition<
  z.input<typeof memoryInputSchema>,
  z.input<typeof memoryOutputSchema>
> => ({
  key: "memory-agent",
  role: "memory",
  inputSchema: memoryInputSchema,
  outputSchema: memoryOutputSchema,
  async invoke(input: z.input<typeof memoryInputSchema>, state: SwarmState) {
    void state;
    return deriveMemoryCheckpoint(input);
  },
});
