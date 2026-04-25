import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import apiRoutes from "./api/routes";
import { config } from "./config/env.config";
import { logger } from "./utils/logger.util";

export const createServer = () => {
  const app = express();

  app.use(
    cors({
      origin: config.FRONTEND_ORIGIN,
      credentials: true,
    }),
  );
  app.use(helmet());
  app.use(express.json());
  app.use(morgan(config.NODE_ENV === "development" ? "dev" : "combined"));

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
      logger.error("Unhandled error", err);
      res.status(500).json({
        success: false,
        error: err.message || "Internal Server Error",
      });
    },
  );

  return app;
};
