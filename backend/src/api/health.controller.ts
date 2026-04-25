import type { Request, Response } from "express";

export const healthCheck = (_req: Request, res: Response) => {
  res.json({
    success: true,
    service: "omen-backend",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
};
