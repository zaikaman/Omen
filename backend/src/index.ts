import { createServer } from "./server";
import { config } from "./config/env.config";
import { logger } from "./utils/logger.util";

const app = createServer();
const server = app.listen(config.PORT, () => {
  logger.info(`Server is running at http://localhost:${config.PORT}`);
  logger.info(`Environment: ${config.NODE_ENV}`);
});

const shutdown = (signal: string) => {
  logger.info(`${signal} received. Shutting down gracefully.`);
  server.close(() => {
    logger.info("HTTP server closed.");
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
