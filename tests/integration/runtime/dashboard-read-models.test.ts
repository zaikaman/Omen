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
} from "../../fixtures/demo-runtime";
import {
  buildAnalyticsSnapshotsReadModel,
  buildLatestAnalyticsSnapshotReadModel,
  projectAnalyticsSnapshots,
} from "../../../backend/src/read-models/analytics-snapshots";
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
        currentPrice: signal.currentPrice,
        entryPrice: signal.entryPrice,
        targetPrice: signal.targetPrice,
        stopLoss: signal.stopLoss,
        signalStatus: signal.signalStatus,
        pnlPercent: signal.pnlPercent,
        riskReward: signal.riskReward,
        entryZone: signal.entryZone,
        invalidation: signal.invalidation,
        targets: signal.targets,
        whyNow: signal.whyNow,
        criticDecision: signal.criticDecision,
        reportStatus: signal.reportStatus,
        publishedAt: signal.publishedAt,
        createdAt: signal.createdAt,
        updatedAt: signal.updatedAt,
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

    expect(summary.ok).toBe(false);
    if (summary.ok) {
      throw new Error("Expected dashboard read model to require persistence.");
    }

    expect(summary.error.code).toBe("PERSISTENCE_NOT_CONFIGURED");
  });

  it("projects runtime status from active and latest run state plus scheduler timing", async () => {
    const runtimeStatus = await buildRuntimeStatusReadModel({
      env: readModelEnv,
      runtimeMode: demoRuntimeConfig.mode,
      scheduler: demoSchedulerStatus,
    });

    expect(runtimeStatus.ok).toBe(false);
    if (runtimeStatus.ok) {
      throw new Error("Expected runtime status read model to require persistence.");
    }

    expect(runtimeStatus.error.code).toBe("PERSISTENCE_NOT_CONFIGURED");
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

  it("requires persistence for analytics snapshots", async () => {
    const snapshots = await buildAnalyticsSnapshotsReadModel({
      env: readModelEnv,
    });
    const latest = await buildLatestAnalyticsSnapshotReadModel({
      env: readModelEnv,
    });

    expect(snapshots.ok).toBe(false);
    expect(latest.ok).toBe(false);

    if (snapshots.ok || latest.ok) {
      throw new Error("Expected analytics read models to require persistence.");
    }

    expect(snapshots.error.code).toBe("PERSISTENCE_NOT_CONFIGURED");
    expect(latest.error.code).toBe("PERSISTENCE_NOT_CONFIGURED");
  });

  it("projects analytics snapshots from runs, published signals, and published intel", () => {
    const snapshots = projectAnalyticsSnapshots({
      runs: demoRunBundles.map((bundle) => bundle.run),
      signals: demoRunBundles
        .map((bundle) => bundle.signal)
        .filter((signal): signal is NonNullable<typeof signal> => signal !== null),
      intels: demoRunBundles
        .map((bundle) => bundle.intel)
        .filter((intel): intel is NonNullable<typeof intel> => intel !== null),
    });

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0]).toMatchObject({
      id: "analytics-run-signal-001",
      runId: "run-signal-001",
      totals: {
        totalRuns: 1,
        completedRuns: 1,
        publishedSignals: 1,
        publishedIntel: 0,
      },
      confidenceBands: [{ label: "90-94", value: 1 }],
      tokenFrequency: [{ label: "BTC", value: 1 }],
      mindshare: [{ label: "BTC", value: 100 }],
      winRate: 100,
    });
    expect(snapshots[1]).toMatchObject({
      id: "analytics-run-intel-001",
      runId: "run-intel-001",
      totals: {
        totalRuns: 2,
        completedRuns: 2,
        publishedSignals: 1,
        publishedIntel: 1,
      },
      confidenceBands: [
        { label: "85-89", value: 1 },
        { label: "90-94", value: 1 },
      ],
      mindshare: [
        { label: "AKT", value: 25 },
        { label: "BTC", value: 25 },
        { label: "RNDR", value: 25 },
        { label: "TAO", value: 25 },
      ],
      winRate: 100,
    });
    expect(snapshots[1]?.tokenFrequency).toEqual([
      { label: "AKT", value: 1 },
      { label: "BTC", value: 1 },
      { label: "RNDR", value: 1 },
      { label: "TAO", value: 1 },
    ]);
  });
});
