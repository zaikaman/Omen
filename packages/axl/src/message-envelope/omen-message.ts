import { axlEnvelopeSchema } from "@omen/shared";
import { err, ok, type Result } from "@omen/shared";
import { z } from "zod";

export const omenMessageBodySchema = z.object({
  envelope: axlEnvelopeSchema,
  body: z.record(z.string(), z.unknown()).default({}),
});

export const createOmenMessage = (input: z.input<typeof omenMessageBodySchema>) =>
  omenMessageBodySchema.parse(input);

export const serializeOmenMessage = (
  input: z.input<typeof omenMessageBodySchema>,
) => JSON.stringify(createOmenMessage(input));

export const deserializeOmenMessage = (
  input: string,
): Result<z.infer<typeof omenMessageBodySchema>, Error> => {
  try {
    const payload = JSON.parse(input) as unknown;
    return ok(omenMessageBodySchema.parse(payload));
  } catch (error) {
    return err(
      error instanceof Error
        ? error
        : new Error("Failed to deserialize Omen AXL message."),
    );
  }
};

export type OmenMessageBody = z.infer<typeof omenMessageBodySchema>;
