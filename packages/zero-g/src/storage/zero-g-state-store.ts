import { err, ok, type ProofArtifact, type Result } from "@omen/shared";
import { z } from "zod";

import type { ZeroGAdapter } from "../adapters/zero-g-adapter.js";
import { ZeroGNamespaceBuilder } from "./namespace.js";

export const zeroGCheckpointWriteSchema = z.object({
  environment: z.string().min(1),
  runId: z.string().min(1),
  checkpointLabel: z.string().min(1),
  state: z.unknown(),
  signalId: z.string().min(1).nullable().optional(),
  intelId: z.string().min(1).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type ZeroGCheckpointWrite = z.infer<typeof zeroGCheckpointWriteSchema>;

export class ZeroGStateStore {
  private readonly namespaceBuilder: ZeroGNamespaceBuilder;

  constructor(
    private readonly adapter: ZeroGAdapter,
    namespaceBuilder = new ZeroGNamespaceBuilder(),
  ) {
    this.namespaceBuilder = namespaceBuilder;
  }

  async writeRunCheckpoint(
    input: z.input<typeof zeroGCheckpointWriteSchema>,
  ): Promise<Result<ProofArtifact, Error>> {
    const parsed = zeroGCheckpointWriteSchema.parse(input);
    const key = this.namespaceBuilder.buildStateKey({
      environment: parsed.environment,
      scope: "run",
      runId: parsed.runId,
      segments: ["checkpoints"],
      checkpoint: parsed.checkpointLabel,
    });
    const serializedState = this.serializeState(parsed.state);

    if (!serializedState.ok) {
      return serializedState;
    }

    const stored = await this.adapter.putState({
      key,
      value: serializedState.value,
      metadata: {
        checkpointLabel: parsed.checkpointLabel,
        ...parsed.metadata,
      },
    });

    if (!stored.ok) {
      return stored;
    }

    return ok({
      ...stored.value,
      id: `${parsed.runId}:${parsed.checkpointLabel}:kv`,
      runId: parsed.runId,
      signalId: parsed.signalId ?? null,
      intelId: parsed.intelId ?? null,
      key,
      metadata: {
        checkpointLabel: parsed.checkpointLabel,
        ...stored.value.metadata,
      },
    });
  }

  private serializeState(state: unknown): Result<string, Error> {
    try {
      return ok(JSON.stringify(state));
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to serialize swarm state for 0G KV storage."),
      );
    }
  }
}
