import { describe, expect, it } from "vitest";

import {
  runListItemSchema,
  runtimeModeSchema,
  schedulerStatusSchema,
} from "../../../packages/shared/src/index";
import {
  demoRunBundles,
  demoRuntimeConfig,
  demoSchedulerStatus,
} from "../../../packages/db/src/index";

describe("runtime runs api contract", () => {
  it("accepts the read-only scheduled run history response contract for GET /api/runs", () => {
    const response = {
      success: true,
      data: {
        runs: demoRunBundles.map(({ run }) => ({
          id: run.id,
          mode: run.mode,
          status: run.status,
          marketBias: run.marketBias,
          startedAt: run.startedAt,
          completedAt: run.completedAt,
          triggeredBy: run.triggeredBy,
          finalSignalId: run.finalSignalId,
          finalIntelId: run.finalIntelId,
          failureReason: run.failureReason,
          outcome: run.outcome,
        })),
        nextCursor: null,
        total: demoRunBundles.length,
      },
    };

    expect(response.success).toBe(true);
    expect(response.data.nextCursor).toBeNull();
    expect(response.data.total).toBe(2);
    expect(() =>
      response.data.runs.forEach((run) => {
        runListItemSchema.parse(run);
      }),
    ).not.toThrow();
  });

  it("accepts the read-only runtime status response contract for GET /api/status", () => {
    const latestRun = demoRunBundles[demoRunBundles.length - 1]?.run ?? null;

    const response = {
      success: true,
      data: {
        runtimeMode: demoRuntimeConfig.mode,
        scheduler: demoSchedulerStatus,
        activeRun: null,
        latestRun: latestRun
          ? {
              id: latestRun.id,
              mode: latestRun.mode,
              status: latestRun.status,
              marketBias: latestRun.marketBias,
              startedAt: latestRun.startedAt,
              completedAt: latestRun.completedAt,
              triggeredBy: latestRun.triggeredBy,
              finalSignalId: latestRun.finalSignalId,
              finalIntelId: latestRun.finalIntelId,
              failureReason: latestRun.failureReason,
              outcome: latestRun.outcome,
            }
          : null,
        lastCompletedRunId: latestRun?.id ?? null,
      },
    };

    expect(response.success).toBe(true);
    expect(runtimeModeSchema.parse(response.data.runtimeMode)).toBe("mocked");
    expect(schedulerStatusSchema.parse(response.data.scheduler)).toMatchObject({
      enabled: true,
      scanIntervalMinutes: 60,
    });
    expect(response.data.activeRun).toBeNull();
    expect(response.data.lastCompletedRunId).toBe("run-intel-001");
    expect(() => {
      if (response.data.latestRun) {
        runListItemSchema.parse(response.data.latestRun);
      }
    }).not.toThrow();
  });
});
