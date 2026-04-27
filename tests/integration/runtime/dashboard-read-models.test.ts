import { describe, expect, it } from "vitest";

import {
  analyticsFeedResponseSchema,
  analyticsLatestResponseSchema,
  dashboardSummarySchema,
  intelDetailResponseSchema,
  intelFeedResponseSchema,
  runListItemSchema,
  signalDetailResponseSchema,
  signalFeedResponseSchema,
} from "../../../packages/shared/src/index";
import {
  demoAnalyticsSnapshots,
  demoDashboardSummary,
  demoRunBundles,
  demoSchedulerStatus,
} from "../../../packages/db/src/index";

const projectRunListItem = (run: (typeof demoRunBundles)[number]["run"]) =>
  runListItemSchema.parse({
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
  });

const projectDashboardSummary = () => {
  const latestRunBundle = demoRunBundles[demoRunBundles.length - 1] ?? null;
  const latestSignalBundle = [...demoRunBundles]
    .reverse()
    .find((bundle) => bundle.signal !== null);
  const latestIntelBundle = [...demoRunBundles]
    .reverse()
    .find((bundle) => bundle.intel !== null);
  const latestPost = [...demoRunBundles]
    .flatMap((bundle) => bundle.outboundPosts)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
  const latestAnalytics = demoAnalyticsSnapshots[demoAnalyticsSnapshots.length - 1] ?? null;

  return dashboardSummarySchema.parse({
    activeRun: null,
    latestRun: latestRunBundle ? projectRunListItem(latestRunBundle.run) : null,
    latestSignalId: latestSignalBundle?.signal?.id ?? null,
    latestIntelId: latestIntelBundle?.intel?.id ?? null,
    scheduler: demoSchedulerStatus,
    latestPost,
    analytics: latestAnalytics,
  });
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
  it("projects the dashboard summary from persisted runs, scheduler state, posts, and analytics", () => {
    const summary = projectDashboardSummary();

    expect(summary).toEqual(demoDashboardSummary);
    expect(summary.latestRun).not.toBeNull();
    expect(summary.latestRun?.id).toBe("run-intel-001");
    expect(summary.scheduler).toMatchObject({
      enabled: true,
      isRunning: false,
      scanIntervalMinutes: 60,
    });
    expect(summary.latestPost).toMatchObject({
      id: "post-intel-001",
      runId: summary.latestRun?.id,
    });
    expect(summary.analytics).toMatchObject({
      id: "analytics-snapshot-002",
      runId: summary.latestRun?.id,
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
