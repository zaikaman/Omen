import { randomUUID } from "node:crypto";

import { RunsRepository, createSupabaseServiceRoleClient } from "@omen/db";

import { createBackendEnv } from "../bootstrap/env.js";
import { createLogger } from "../bootstrap/logger.js";
import { DefaultRunCoordinator } from "../coordinator/run-coordinator.js";
import { DefaultLiveSwarmRunPipeline } from "../pipelines/live-swarm-pipeline.js";
import { getRuntimeModeFlags } from "../scheduler/runtime-mode.js";

const runScheduledCycle = async () => {
  const env = createBackendEnv();
  const logger = createLogger(env);
  const mode = getRuntimeModeFlags(env.runtimeMode);
  const pipeline = new DefaultLiveSwarmRunPipeline({ env });
  const runsRepository =
    env.supabase.url && env.supabase.serviceRoleKey
      ? new RunsRepository(
          createSupabaseServiceRoleClient({
            url: env.supabase.url,
            anonKey: env.supabase.anonKey ?? env.supabase.serviceRoleKey,
            serviceRoleKey: env.supabase.serviceRoleKey,
            schema: env.supabase.schema,
          }),
        )
      : null;
  const coordinator = new DefaultRunCoordinator({
    logger,
    pipeline,
    failedRunStore: runsRepository,
  });

  const runId = `scheduled-${Date.now().toString()}-${randomUUID()}`;
  const result = await coordinator.executeScheduledRun({
    runId,
    trigger: "interval",
    triggeredAt: new Date().toISOString(),
    mode,
  });

  if (result.finalState.run.status !== "completed") {
    throw new Error(
      `Scheduled cycle failed with status ${result.finalState.run.status} for run ${result.runId}.`,
    );
  }

  console.log(
    JSON.stringify(
      {
        runId: result.runId,
        mode: mode.mode,
        status: result.finalState.run.status,
        outcomeType: result.outcomeType,
        checkpointCount: result.checkpointCount,
      },
      null,
      2,
    ),
  );
};

void runScheduledCycle().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
