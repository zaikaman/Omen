import { createBackendEnv } from "../bootstrap/env";
import { createLogger } from "../bootstrap/logger";
import { DefaultRunCoordinator } from "../coordinator/run-coordinator";
import { DefaultDemoRunPipeline } from "../pipelines/demo-run-pipeline";
import { DefaultLiveSwarmRunPipeline } from "../pipelines/live-swarm-pipeline";
import { getRuntimeModeFlags } from "../scheduler/runtime-mode";

const runScheduledCycle = async () => {
  const env = createBackendEnv();
  const logger = createLogger(env);
  const mode = getRuntimeModeFlags(env.runtimeMode);
  const pipeline = mode.usesMockData
    ? new DefaultDemoRunPipeline()
    : new DefaultLiveSwarmRunPipeline({ env });
  const coordinator = new DefaultRunCoordinator({
    logger,
    pipeline,
  });

  const runId = `scheduled-${Date.now().toString()}`;
  const result = await coordinator.executeScheduledRun({
    runId,
    trigger: "interval",
    triggeredAt: new Date().toISOString(),
    mode,
  });

  if (result.finalState.run.status !== "completed") {
    throw new Error(
      `Scheduled cycle failed with status ${result.finalState.run.status} for run ${runId}.`,
    );
  }

  console.log(
    JSON.stringify(
      {
        runId,
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
