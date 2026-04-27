import { describe, expect, it } from "vitest";

import {
  analyticsSnapshotSchema,
  dashboardSummarySchema,
  intelDetailResponseSchema,
  intelFeedResponseSchema,
  logFeedResponseSchema,
  signalDetailResponseSchema,
  signalFeedResponseSchema,
} from "../../../packages/shared/src/index";
import {
  demoAnalyticsSnapshots,
  demoDashboardSummary,
  demoRunBundles,
} from "../../../packages/db/src/index";

const analyticsFeedResponseSchema = {
  parse: (input: unknown) => {
    const payload = input as { items?: unknown[]; nextCursor?: unknown };
    return {
      items: Array.isArray(payload.items)
        ? payload.items.map((item) => analyticsSnapshotSchema.parse(item))
        : [],
      nextCursor:
        typeof payload.nextCursor === "string" ? payload.nextCursor : null,
    };
  },
};

const analyticsLatestResponseSchema = {
  parse: (input: unknown) => {
    const payload = input as { item?: unknown };
    return {
      item: payload.item == null ? null : analyticsSnapshotSchema.parse(payload.item),
    };
  },
};

describe("dashboard mvp api contract", () => {
  it("accepts the dashboard summary response contract for GET /api/dashboard/summary", () => {
    const response = {
      success: true,
      data: demoDashboardSummary,
    };

    expect(response.success).toBe(true);
    expect(dashboardSummarySchema.parse(response.data)).toMatchObject({
      activeRun: null,
      latestRun: { id: "run-intel-001" },
      latestSignalId: "signal-btc-long-001",
      latestIntelId: "intel-ai-rotation-001",
      latestPost: { id: "post-intel-001" },
      analytics: { id: "analytics-snapshot-002" },
    });
  });

  it("accepts the intel feed response contract for GET /api/intel", () => {
    const response = {
      success: true,
      data: {
        items: demoRunBundles
          .map((bundle) => bundle.intel)
          .filter((intel): intel is NonNullable<typeof intel> => intel !== null)
          .map((intel) => ({
            id: intel.id,
            runId: intel.runId,
            title: intel.title,
            slug: intel.slug,
            summary: intel.summary,
            category: intel.category,
            status: intel.status,
            symbols: intel.symbols,
            confidence: intel.confidence,
            publishedAt: intel.publishedAt,
            createdAt: intel.createdAt,
          })),
        nextCursor: null,
      },
    };

    expect(response.success).toBe(true);
    expect(intelFeedResponseSchema.parse(response.data)).toMatchObject({
      items: [
        {
          id: "intel-ai-rotation-001",
          slug: "ai-infrastructure-rotation-2026-04-25",
          category: "narrative_shift",
        },
      ],
      nextCursor: null,
    });
  });

  it("accepts the intel detail response contract for GET /api/intel/:id", () => {
    const intel = demoRunBundles.find((bundle) => bundle.intel !== null)?.intel;
    const response = {
      success: true,
      data: {
        item: intel,
      },
    };

    expect(response.success).toBe(true);
    expect(intel).not.toBeNull();
    expect(intelDetailResponseSchema.parse(response.data)).toMatchObject({
      item: {
        id: "intel-ai-rotation-001",
        status: "published",
        symbols: ["TAO", "RNDR", "AKT"],
      },
    });
  });

  it("accepts the signal feed response contract for GET /api/signals", () => {
    const response = {
      success: true,
      data: {
        items: demoRunBundles
          .map((bundle) => bundle.signal)
          .filter((signal): signal is NonNullable<typeof signal> => signal !== null)
          .map((signal) => ({
            id: signal.id,
            runId: signal.runId,
            asset: signal.asset,
            direction: signal.direction,
            confidence: signal.confidence,
            riskReward: signal.riskReward,
            criticDecision: signal.criticDecision,
            reportStatus: signal.reportStatus,
            publishedAt: signal.publishedAt,
          })),
        total: demoRunBundles.filter((bundle) => bundle.signal !== null).length,
        nextCursor: null,
      },
    };

    expect(response.success).toBe(true);
    expect(signalFeedResponseSchema.parse(response.data)).toMatchObject({
      items: [
        {
          id: "signal-btc-long-001",
          asset: "BTC",
          direction: "LONG",
          criticDecision: "approved",
        },
      ],
      total: 1,
      nextCursor: null,
    });
  });

  it("accepts the signal detail response contract for GET /api/signals/:id", () => {
    const signal = demoRunBundles.find((bundle) => bundle.signal !== null)?.signal;
    const response = {
      success: true,
      data: {
        item: signal,
      },
    };

    expect(response.success).toBe(true);
    expect(signal).not.toBeNull();
    expect(signalDetailResponseSchema.parse(response.data)).toMatchObject({
      item: {
        id: "signal-btc-long-001",
        asset: "BTC",
        direction: "LONG",
        reportStatus: "published",
        finalReportRefId: "proof-signal-manifest-001",
      },
    });
  });

  it("accepts the analytics feed response contract for GET /api/analytics", () => {
    const response = {
      success: true,
      data: {
        items: demoAnalyticsSnapshots,
        nextCursor: null,
      },
    };

    expect(response.success).toBe(true);
    expect(analyticsFeedResponseSchema.parse(response.data)).toMatchObject({
      items: [
        { id: "analytics-snapshot-001", runId: "run-signal-001" },
        { id: "analytics-snapshot-002", runId: "run-intel-001" },
      ],
      nextCursor: null,
    });
  });

  it("accepts the latest analytics response contract for GET /api/analytics/latest", () => {
    const response = {
      success: true,
      data: {
        item: demoAnalyticsSnapshots[demoAnalyticsSnapshots.length - 1] ?? null,
      },
    };

    expect(response.success).toBe(true);
    expect(analyticsLatestResponseSchema.parse(response.data)).toMatchObject({
      item: {
        id: "analytics-snapshot-002",
        totals: {
          totalRuns: 2,
          completedRuns: 2,
          publishedSignals: 1,
          publishedIntel: 1,
        },
        winRate: 100,
      },
    });
  });

  it("accepts the logs feed response contract for GET /api/logs", () => {
    const response = {
      success: true,
      data: {
        items: demoRunBundles
          .flatMap((bundle) => bundle.events)
          .sort((left, right) => left.timestamp.localeCompare(right.timestamp)),
        nextCursor: null,
      },
    };

    expect(response.success).toBe(true);
    const parsed = logFeedResponseSchema.parse(response.data);
    expect(parsed.nextCursor).toBeNull();
    expect(parsed.items).toHaveLength(10);
    expect(parsed.items[0]).toMatchObject({
      id: "event-signal-001",
      eventType: "run_created",
    });
    expect(parsed.items[parsed.items.length - 1]).toMatchObject({
      id: "event-intel-004",
      eventType: "report_published",
    });
  });
});
