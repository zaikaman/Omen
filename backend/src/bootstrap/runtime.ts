import type { Server } from "node:http";

import { createBackendEnv, type BackendEnv } from "./env";
import { createLogger, type Logger } from "./logger";
import { registerGracefulShutdown } from "./shutdown";
import { createServer } from "../server";
import { getRuntimeModeFlags } from "../scheduler/runtime-mode";

export type BackendRuntime = {
  env: BackendEnv;
  logger: Logger;
  server: Server;
};

export const startBackendRuntime = (): BackendRuntime => {
  const env = createBackendEnv();
  const logger = createLogger(env);
  const runtimeMode = getRuntimeModeFlags(env.runtimeMode);
  const app = createServer({ env, logger });

  const server = app.listen(env.port, () => {
    logger.info(`Server is running at http://localhost:${env.port.toString()}`);
    logger.info(`Environment: ${env.nodeEnv}`);
    logger.info(`Runtime mode: ${runtimeMode.label}`);
    logger.info(
      `Runtime flags: mock=${runtimeMode.usesMockData.toString()} reads=${runtimeMode.allowsExternalReads.toString()} writes=${runtimeMode.allowsExternalWrites.toString()}`,
    );
  });

  registerGracefulShutdown({ server, logger });

  return { env, logger, server };
};
