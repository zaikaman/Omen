import type { Server } from "node:http";

import type { Logger } from "./logger";

export type ShutdownHandler = () => Promise<void> | void;

export const registerGracefulShutdown = (input: {
  server: Server;
  logger: Logger;
  onShutdown?: ShutdownHandler;
}) => {
  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    input.logger.info(`${signal} received. Shutting down gracefully.`);

    try {
      await input.onShutdown?.();
    } catch (error) {
      input.logger.error("Shutdown hook failed.", error);
    }

    input.server.close((closeError) => {
      if (closeError) {
        input.logger.error("HTTP server close failed.", closeError);
        process.exitCode = 1;
      } else {
        input.logger.info("HTTP server closed.");
      }
    });
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  process.on("uncaughtException", (error) => {
    input.logger.error("Uncaught exception.", error);
    void shutdown("uncaughtException");
  });

  process.on("unhandledRejection", (error) => {
    input.logger.error("Unhandled rejection.", error);
    void shutdown("unhandledRejection");
  });
};
