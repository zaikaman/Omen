import type { Server } from "node:http";

import { RunsRepository, createSupabaseServiceRoleClient } from "@omen/db";

import { createBackendEnv, type BackendEnv } from "./env.js";
import { createLogger, type Logger } from "./logger.js";
import { registerGracefulShutdown } from "./shutdown.js";
import { createServer } from "../server.js";
import { DefaultRunCoordinator } from "../coordinator/run-coordinator.js";
import { DefaultDemoRunPipeline } from "../pipelines/demo-run-pipeline.js";
import { DefaultLiveSwarmRunPipeline } from "../pipelines/live-swarm-pipeline.js";
import { HourlyScheduler } from "../scheduler/hourly-scheduler.js";
import { RunLock } from "../scheduler/run-lock.js";
import { getRuntimeModeFlags } from "../scheduler/runtime-mode.js";
import { DefaultRuntimeWorker } from "../workers/runtime-worker.js";

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
  const schedulerRunsRepository =
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
  const pipeline = runtimeMode.usesMockData
    ? new DefaultDemoRunPipeline()
    : new DefaultLiveSwarmRunPipeline({ env });
  const coordinator = new DefaultRunCoordinator({
    logger,
    pipeline,
    failedRunStore: schedulerRunsRepository,
  });
  const runtimeWorker = new DefaultRuntimeWorker({ env, logger, coordinator });
  const scheduler = new HourlyScheduler({
    logger,
    runLock: new RunLock(env.allowConcurrentRuns),
    mode: runtimeMode,
    loadLastRunAt: schedulerRunsRepository
      ? async () => {
          const recentRuns = await schedulerRunsRepository.listRecentRuns(1);

          if (!recentRuns.ok) {
            throw new Error(recentRuns.error.message);
          }

          return recentRuns.value[0]?.createdAt ?? null;
        }
      : undefined,
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
      void scheduler.start();
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
