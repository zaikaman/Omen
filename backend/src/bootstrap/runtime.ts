import type { Server } from "node:http";

import { createBackendEnv, type BackendEnv } from "./env";
import { createLogger, type Logger } from "./logger";
import { registerGracefulShutdown } from "./shutdown";
import { createServer } from "../server";
import { DefaultRunCoordinator } from "../coordinator/run-coordinator";
import { DefaultDemoRunPipeline } from "../pipelines/demo-run-pipeline";
import { DefaultLiveSwarmRunPipeline } from "../pipelines/live-swarm-pipeline";
import { HourlyScheduler } from "../scheduler/hourly-scheduler";
import { RunLock } from "../scheduler/run-lock";
import { getRuntimeModeFlags } from "../scheduler/runtime-mode";
import { DefaultRuntimeWorker } from "../workers/runtime-worker";

export type BackendRuntime = {
  env: BackendEnv;
  logger: Logger;
  server: Server;
  scheduler: HourlyScheduler;
};

export const startBackendRuntime = (): BackendRuntime => {
  const env = createBackendEnv();
  const logger = createLogger(env);
  const runtimeMode = getRuntimeModeFlags(env.runtimeMode);
  const pipeline =
    runtimeMode.usesMockData
      ? new DefaultDemoRunPipeline()
      : new DefaultLiveSwarmRunPipeline({ env });
  const coordinator = new DefaultRunCoordinator({ logger, pipeline });
  const runtimeWorker = new DefaultRuntimeWorker({ logger, coordinator });
  const scheduler = new HourlyScheduler({
    logger,
    runLock: new RunLock(env.allowConcurrentRuns),
    mode: runtimeMode,
    task: async (context) => {
      await runtimeWorker.execute(context);
    },
  });
  const app = createServer({
    env,
    logger,
    getSchedulerStatus: () => scheduler.getStatus(),
  });

  const server = app.listen(env.port, () => {
    logger.info(`Server is running at http://localhost:${env.port.toString()}`);
    logger.info(`Environment: ${env.nodeEnv}`);
    logger.info(`Runtime mode: ${runtimeMode.label}`);
    logger.info(
      `Runtime flags: mock=${runtimeMode.usesMockData.toString()} reads=${runtimeMode.allowsExternalReads.toString()} writes=${runtimeMode.allowsExternalWrites.toString()}`,
    );

    if (env.schedulerEnabled) {
      scheduler.start();
      logger.info("Hourly scheduler started.");
    } else {
      logger.info("Hourly scheduler disabled by env.");
    }
  });

  registerGracefulShutdown({
    server,
    logger,
    onShutdown: async () => {
      if (env.schedulerEnabled) {
        await scheduler.stop();
        logger.info("Hourly scheduler stopped.");
      }
    },
  });

  return { env, logger, server, scheduler };
};
