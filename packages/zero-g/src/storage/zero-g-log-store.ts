import { ok, type ProofArtifact, type Result } from "@omen/shared";
import { z } from "zod";

import type { ZeroGAdapter } from "../adapters/zero-g-adapter.js";
import { ZeroGNamespaceBuilder } from "./namespace.js";

export const zeroGRunLogWriteSchema = z.object({
  environment: z.string().min(1),
  runId: z.string().min(1),
  stream: z.string().min(1),
  content: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  signalId: z.string().min(1).nullable().optional(),
  intelId: z.string().min(1).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type ZeroGRunLogWrite = z.infer<typeof zeroGRunLogWriteSchema>;

export class ZeroGLogStore {
  private readonly namespaceBuilder: ZeroGNamespaceBuilder;

  constructor(
    private readonly adapter: ZeroGAdapter,
    namespaceBuilder = new ZeroGNamespaceBuilder(),
  ) {
    this.namespaceBuilder = namespaceBuilder;
  }

  async appendRunLog(
    input: z.input<typeof zeroGRunLogWriteSchema>,
  ): Promise<Result<ProofArtifact, Error>> {
    const parsed = zeroGRunLogWriteSchema.parse(input);
    const stream = this.namespaceBuilder.buildLogStream({
      environment: parsed.environment,
      scope: "run",
      runId: parsed.runId,
      segments: ["events"],
      stream: parsed.stream,
    });
    const content =
      typeof parsed.content === "string" ? parsed.content : parsed.content.join("\n");
    const appended = await this.adapter.appendLog({
      stream,
      content,
      metadata: {
        entryCount: typeof parsed.content === "string" ? 1 : parsed.content.length,
        ...parsed.metadata,
      },
    });

    if (!appended.ok) {
      return appended;
    }

    return ok({
      ...appended.value,
      id: `${parsed.runId}:${parsed.stream}:log`,
      runId: parsed.runId,
      signalId: parsed.signalId ?? null,
      intelId: parsed.intelId ?? null,
      key: stream,
      metadata: {
        stream,
        ...appended.value.metadata,
      },
    });
  }
}
