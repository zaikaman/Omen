import { describe, expect, it } from "vitest";

import {
  analyticsFeedResponseSchema,
  analyticsLatestResponseSchema,
  intelDetailResponseSchema,
  intelFeedResponseSchema,
  signalDetailResponseSchema,
  signalFeedResponseSchema,
} from "../../../packages/shared/src/index";
import {
  demoAnalyticsSnapshots,
  demoDashboardSummary,
  demoRunBundles,
  demoRuntimeConfig,
  demoSchedulerStatus,
} from "../../../packages/db/src/index";
import { buildDashboardSummaryReadModel } from "../../../backend/src/read-models/dashboard-summary";
import { buildRuntimeStatusReadModel } from "../../../backend/src/read-models/runtime-status";

const readModelEnv = {
  supabase: {
    url: null,
    anonKey: null,
    serviceRoleKey: null,
    schema: "public",
    projectId: null,
    dbPassword: null,
  },
};

const projectIntelFeed = () =>
  intelFeedResponseSchema.parse({
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
  });

const projectSignalFeed = () =>
  signalFeedResponseSchema.parse({
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
  });

describe("dashboard read models", () => {
  it("projects the dashboard summary from persisted runs, scheduler state, posts, and analytics", async () => {
    const summary = await buildDashboardSummaryReadModel({
      env: readModelEnv,
      scheduler: demoSchedulerStatus,
    });

    expect(summary.ok).toBe(true);
    if (!summary.ok) {
      throw new Error(summary.error.message);
    }

    expect(summary.value).toEqual(demoDashboardSummary);
    expect(summary.value.latestRun).not.toBeNull();
    expect(summary.value.latestRun?.id).toBe("run-intel-001");
    expect(summary.value.scheduler).toMatchObject({
      enabled: true,
      isRunning: false,
      scanIntervalMinutes: 60,
    });
    expect(summary.value.latestPost).toMatchObject({
      id: "post-intel-001",
      runId: summary.value.latestRun?.id,
    });
    expect(summary.value.analytics).toMatchObject({
      id: "analytics-snapshot-002",
      runId: summary.value.latestRun?.id,
    });
  });

  it("projects runtime status from active and latest run state plus scheduler timing", async () => {
    const runtimeStatus = await buildRuntimeStatusReadModel({
      env: readModelEnv,
      runtimeMode: demoRuntimeConfig.mode,
      scheduler: demoSchedulerStatus,
    });

    expect(runtimeStatus.ok).toBe(true);
    if (!runtimeStatus.ok) {
      throw new Error(runtimeStatus.error.message);
    }

    expect(runtimeStatus.value).toMatchObject({
      runtimeMode: "mocked",
      scheduler: demoSchedulerStatus,
      activeRun: null,
      latestRun: { id: "run-intel-001" },
      lastCompletedRunId: "run-intel-001",
    });
  });

  it("projects intel feed and detail responses from intel-producing runs", () => {
    const feed = projectIntelFeed();
    const sourceBundle = demoRunBundles.find((bundle) => bundle.intel !== null);
    const detail = intelDetailResponseSchema.parse({
      item: sourceBundle?.intel,
    });

    expect(feed.items).toHaveLength(1);
    expect(feed.nextCursor).toBeNull();
    expect(feed.items[0]).toMatchObject({
      id: sourceBundle?.run.finalIntelId,
      runId: sourceBundle?.run.id,
      status: "published",
      category: "narrative_shift",
    });

    expect(detail.item).toMatchObject({
      id: sourceBundle?.run.finalIntelId,
      runId: sourceBundle?.run.id,
      proofRefIds: sourceBundle?.proofs.map((proof) => proof.id),
    });
    expect(detail.item.sources).toHaveLength(2);
    expect(detail.item.publishedAt).toBe(sourceBundle?.outboundPosts[0]?.publishedAt ?? null);
  });

  it("projects signal feed and detail responses from signal-producing runs", () => {
    const feed = projectSignalFeed();
    const sourceBundle = demoRunBundles.find((bundle) => bundle.signal !== null);
    const detail = signalDetailResponseSchema.parse({
      item: sourceBundle?.signal,
    });

    expect(feed.items).toHaveLength(1);
    expect(feed.total).toBe(1);
    expect(feed.nextCursor).toBeNull();
    expect(feed.items[0]).toMatchObject({
      id: sourceBundle?.run.finalSignalId,
      runId: sourceBundle?.run.id,
      asset: "BTC",
      direction: "LONG",
      reportStatus: "published",
    });

    expect(detail.item).toMatchObject({
      id: sourceBundle?.run.finalSignalId,
      runId: sourceBundle?.run.id,
      finalReportRefId: sourceBundle?.proofBundle.manifestRefId,
    });
    expect(detail.item.targets).toHaveLength(2);
    expect(detail.item.proofRefIds).toEqual(sourceBundle?.proofs.map((proof) => proof.id));
  });

  it("projects analytics feed and latest responses cumulatively across completed runs", () => {
    const feed = analyticsFeedResponseSchema.parse({
      items: demoAnalyticsSnapshots,
      nextCursor: null,
    });
    const latest = analyticsLatestResponseSchema.parse({
      item: demoAnalyticsSnapshots[demoAnalyticsSnapshots.length - 1] ?? null,
    });
    const totalCompletedRuns = demoRunBundles.filter(
      (bundle) => bundle.run.status === "completed",
    ).length;

    expect(feed.items).toHaveLength(2);
    expect(feed.nextCursor).toBeNull();
    expect(feed.items.map((item) => item.totals.totalRuns)).toEqual([1, 2]);
    expect(feed.items.map((item) => item.totals.completedRuns)).toEqual([1, 2]);
    expect(feed.items[1]?.totals.publishedSignals).toBe(1);
    expect(feed.items[1]?.totals.publishedIntel).toBe(1);

    expect(latest.item).not.toBeNull();
    expect(latest.item).toMatchObject({
      id: "analytics-snapshot-002",
      runId: "run-intel-001",
      totals: {
        totalRuns: demoRunBundles.length,
        completedRuns: totalCompletedRuns,
      },
      winRate: 100,
    });
    expect(latest.item?.mindshare).toEqual(demoDashboardSummary.analytics?.mindshare ?? []);
  });
});
