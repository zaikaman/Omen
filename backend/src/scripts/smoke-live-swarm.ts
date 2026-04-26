import { createBackendEnv } from "../bootstrap/env";
import { DefaultLiveSwarmRunPipeline } from "../pipelines/live-swarm-pipeline";
import { getRuntimeModeFlags } from "../scheduler/runtime-mode";

const runSmokeCycle = async () => {
  const env = createBackendEnv();
  const mode = getRuntimeModeFlags("production_like");
  const pipeline = new DefaultLiveSwarmRunPipeline({
    env,
    postToXEnabledOverride: false,
    runtimeName: "backend-smoke-live-swarm",
  });
  const runId = `smoke-${Date.now().toString()}`;
  const result = await pipeline.run({
    runId,
    trigger: "interval",
    triggeredAt: new Date().toISOString(),
    mode,
  });

  if (result.finalState.run.status !== "completed") {
    throw new Error(
      `Smoke cycle did not complete successfully. Final status: ${result.finalState.run.status}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        runId: result.runId,
        mode: mode.mode,
        writesEnabled: mode.allowsExternalWrites,
        postToXEnabled: result.finalState.config.postToXEnabled,
        marketBias: result.finalState.run.marketBias,
        outcomeType: result.outcomeType,
        checkpointCount: result.checkpointCount,
        candidateCount: result.finalState.activeCandidates.length,
        evidenceCount: result.finalState.evidenceItems.length,
        notesPreview: result.finalState.notes.slice(0, 5),
      },
      null,
      2,
    ),
  );
};

void runSmokeCycle().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
