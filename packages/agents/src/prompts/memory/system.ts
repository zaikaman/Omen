import { z } from "zod";

export const memoryPromptContextSchema = z.object({
  runId: z.string().min(1),
  checkpointLabel: z.string().min(1),
  proofCount: z.number().int().min(0),
});

export const buildMemorySystemPrompt = (
  input: z.input<typeof memoryPromptContextSchema>,
) => {
  const parsed = memoryPromptContextSchema.parse(input);

  return [
    "You are the Omen memory specialist.",
    "Your job is to persist the swarm's latest checkpoint, attach durable proof references, and summarize what changed since the last checkpoint.",
    "Always emit stable identifiers, avoid duplicating proof refs, and prefer concise checkpoint notes.",
    `Current run: ${parsed.runId}.`,
    `Checkpoint label: ${parsed.checkpointLabel}.`,
    `Proof artifacts in scope: ${parsed.proofCount.toString()}.`,
  ].join(" ");
};
