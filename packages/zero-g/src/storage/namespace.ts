import {
  zeroGNamespaceDescriptorSchema,
  zeroGNamespaceScopeSchema,
  type ZeroGNamespaceDescriptor,
} from "@omen/shared";
import { z } from "zod";

const zeroGNamespaceSegmentSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value) => value.replace(/[^a-zA-Z0-9._:-]+/g, "-"))
  .transform((value) => value.replace(/-+/g, "-"))
  .transform((value) => value.replace(/^-|-$/g, ""))
  .refine((value) => value.length > 0, {
    message: "Namespace segments must contain at least one safe character.",
  });

export const zeroGNamespaceInputSchema = z.object({
  environment: z.string().min(1),
  scope: zeroGNamespaceScopeSchema,
  runId: z.string().min(1).nullable().optional(),
  signalId: z.string().min(1).nullable().optional(),
  intelId: z.string().min(1).nullable().optional(),
  segments: z.array(z.string().min(1)).default([]),
});

type ZeroGNamespaceInput = z.input<typeof zeroGNamespaceInputSchema>;

export class ZeroGNamespaceBuilder {
  describe(input: ZeroGNamespaceInput): ZeroGNamespaceDescriptor {
    const parsed = zeroGNamespaceInputSchema.parse(input);
    const segments = parsed.segments.map((segment) =>
      zeroGNamespaceSegmentSchema.parse(segment),
    );

    return zeroGNamespaceDescriptorSchema.parse({
      app: "omen",
      environment: zeroGNamespaceSegmentSchema.parse(parsed.environment),
      scope: parsed.scope,
      runId: parsed.runId ?? null,
      signalId: parsed.signalId ?? null,
      intelId: parsed.intelId ?? null,
      segments,
      path: this.buildPathFromParts({
        environment: parsed.environment,
        scope: parsed.scope,
        runId: parsed.runId ?? null,
        signalId: parsed.signalId ?? null,
        intelId: parsed.intelId ?? null,
        segments,
      }),
    });
  }

  buildStateKey(
    input: ZeroGNamespaceInput & {
      checkpoint: string;
    },
  ) {
    const namespace = this.describe(input);
    return `${namespace.path}/kv/${zeroGNamespaceSegmentSchema.parse(input.checkpoint)}`;
  }

  buildLogStream(
    input: ZeroGNamespaceInput & {
      stream: string;
    },
  ) {
    const namespace = this.describe(input);
    return `${namespace.path}/logs/${zeroGNamespaceSegmentSchema.parse(input.stream)}`;
  }

  buildFileBundlePath(
    input: ZeroGNamespaceInput & {
      bundle: string;
    },
  ) {
    const namespace = this.describe(input);
    return `${namespace.path}/files/${zeroGNamespaceSegmentSchema.parse(input.bundle)}`;
  }

  buildManifestPath(runId: string) {
    return this.buildFileBundlePath({
      environment: "runtime",
      scope: "proof",
      runId,
      segments: ["run-manifests"],
      bundle: "manifest.json",
    });
  }

  private buildPathFromParts(input: {
    environment: string;
    scope: z.infer<typeof zeroGNamespaceScopeSchema>;
    runId: string | null;
    signalId: string | null;
    intelId: string | null;
    segments: string[];
  }) {
    const parts = [
      "omen",
      zeroGNamespaceSegmentSchema.parse(input.environment),
      input.scope,
    ];

    if (input.runId) {
      parts.push("run", zeroGNamespaceSegmentSchema.parse(input.runId));
    }

    if (input.signalId) {
      parts.push("signal", zeroGNamespaceSegmentSchema.parse(input.signalId));
    }

    if (input.intelId) {
      parts.push("intel", zeroGNamespaceSegmentSchema.parse(input.intelId));
    }

    parts.push(...input.segments);

    return parts.join("/");
  }
}

export type ZeroGNamespaceInputValue = z.infer<typeof zeroGNamespaceInputSchema>;
