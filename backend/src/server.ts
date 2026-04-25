import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import apiRoutes from "./api/routes";
import type { BackendEnv } from "./bootstrap/env";
import type { Logger } from "./bootstrap/logger";

export const createServer = (input: {
  env: Pick<BackendEnv, "frontendOrigin" | "nodeEnv">;
  logger: Logger;
}) => {
  const app = express();

  app.use(
    cors({
      origin: input.env.frontendOrigin,
      credentials: true,
    }),
  );
  app.use(helmet());
  app.use(express.json());
  app.use(
    morgan(input.env.nodeEnv === "development" ? "dev" : "combined", {
      stream: {
        write: (message: string) => {
          input.logger.info(message.trim());
        },
      },
    }),
  );

  app.use("/api", apiRoutes);

  app.get("/", (_req, res) => {
    res.json({
      service: "Omen Backend",
      version: "1.0.0",
      status: "running",
    });
  });

  app.use(
    (err: Error, _req: Request, res: Response, next: NextFunction) => {
      void next;
      input.logger.error("Unhandled error", err);
      res.status(500).json({
        success: false,
        error: err.message || "Internal Server Error",
      });
    },
  );

  return app;
};
