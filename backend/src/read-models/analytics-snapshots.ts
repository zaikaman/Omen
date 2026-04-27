import {
  IntelsRepository,
  OutboundPostsRepository,
  RunsRepository,
  SignalsRepository,
  createSupabaseServiceRoleClient,
  demoAnalyticsSnapshots,
  type RepositoryError,
} from "@omen/db";
import {
  analyticsSnapshotSchema,
  ok,
  type AnalyticsSnapshot,
  type Intel,
  type OutboundPost,
  type Result,
  type Run,
  type Signal,
} from "@omen/shared";

import type { BackendEnv } from "../bootstrap/env.js";
import {
  projectMindshareSummary,
  projectTokenFrequency,
} from "./token-frequency.js";

type AnalyticsSnapshotsReadModelEnv = Pick<BackendEnv, "supabase">;

export type AnalyticsSnapshotsReadModelInput = {
  env: AnalyticsSnapshotsReadModelEnv;
};

type ProjectionInput = {
  runs: Run[];
  signals: Signal[];
  intels: Intel[];
  posts?: OutboundPost[];
};

const MAX_RECORDS = 1000;

const isPersistenceConfigured = (env: AnalyticsSnapshotsReadModelEnv) =>
  Boolean(env.supabase.url && env.supabase.serviceRoleKey);

const createRepositories = (env: AnalyticsSnapshotsReadModelEnv) => {
  const client = createSupabaseServiceRoleClient({
    url: env.supabase.url ?? "",
    anonKey: env.supabase.anonKey ?? env.supabase.serviceRoleKey ?? "",
    serviceRoleKey: env.supabase.serviceRoleKey ?? "",
    schema: env.supabase.schema,
  });

  return {
    runs: new RunsRepository(client),
    signals: new SignalsRepository(client),
    intels: new IntelsRepository(client),
    posts: new OutboundPostsRepository(client),
  };
};

const getRunSnapshotTimestamp = (run: Run) =>
  run.completedAt ?? run.updatedAt ?? run.startedAt ?? run.createdAt;

const isPublishedSignal = (signal: Signal) => signal.reportStatus === "published";

const isPublishedIntel = (intel: Intel) => intel.status === "published";

const createConfidenceBandLabel = (confidence: number) => {
  if (confidence >= 100) {
    return "100-100";
  }

  const start = Math.floor(confidence / 5) * 5;
  return `${start.toString()}-${(start + 4).toString()}`;
};

const projectConfidenceBands = (
  outputs: Array<Pick<Signal, "confidence"> | Pick<Intel, "confidence">>,
) => {
  const counts = new Map<string, number>();

  for (const output of outputs) {
    const label = createConfidenceBandLabel(output.confidence);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => {
      const leftStart = Number.parseInt(left.label.split("-")[0] ?? "0", 10);
      const rightStart = Number.parseInt(right.label.split("-")[0] ?? "0", 10);
      return leftStart - rightStart;
    });
};

const projectWinRate = (signals: Signal[]) => {
  const closedSignals = signals.filter(
    (signal) =>
      signal.signalStatus === "tp_hit" || signal.signalStatus === "sl_hit",
  );

  if (closedSignals.length > 0) {
    const wins = closedSignals.filter(
      (signal) => signal.signalStatus === "tp_hit",
    ).length;
    return Math.round((wins / closedSignals.length) * 100);
  }

  const actionableSignals = signals.filter(
    (signal) => signal.direction === "LONG" || signal.direction === "SHORT",
  );
  if (actionableSignals.length === 0) {
    return null;
  }
  const approvedSignals = actionableSignals.filter(
    (signal) => signal.criticDecision === "approved",
  ).length;
  return Math.round((approvedSignals / actionableSignals.length) * 100);
};

const projectPerformanceTotals = (signals: Signal[]) => {
  const activeSignals = signals.filter(
    (signal) => signal.signalStatus === "active" || signal.signalStatus === "pending",
  );
  const closedSignals = signals.filter(
    (signal) => signal.signalStatus === "tp_hit" || signal.signalStatus === "sl_hit",
  );
  const totalPnlPercent = closedSignals.reduce(
    (total, signal) => total + (signal.pnlPercent ?? 0),
    0,
  );

  return {
    activeSignals: activeSignals.length,
    closedSignals: closedSignals.length,
    winningSignals: closedSignals.filter(
      (signal) => signal.signalStatus === "tp_hit",
    ).length,
    losingSignals: closedSignals.filter(
      (signal) => signal.signalStatus === "sl_hit",
    ).length,
    totalPnlPercent: Number(totalPnlPercent.toFixed(4)),
    averageR:
      closedSignals.length > 0
        ? Number((totalPnlPercent / closedSignals.length).toFixed(4))
        : null,
  };
};

const groupByRunId = <T extends { runId: string }>(items: T[]) => {
  const grouped = new Map<string, T[]>();

  for (const item of items) {
    const existing = grouped.get(item.runId);

    if (existing) {
      existing.push(item);
      continue;
    }

    grouped.set(item.runId, [item]);
  }

  return grouped;
};

const projectPostingTotals = (posts: OutboundPost[]) => ({
  outboundPosts: posts.length,
  postedToX: posts.filter((post) => post.status === "posted").length,
  failedPosts: posts.filter((post) => post.status === "failed").length,
  latestPostStatus: posts
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]?.status ?? null,
});

export const projectAnalyticsSnapshots = (
  input: ProjectionInput,
): AnalyticsSnapshot[] => {
  const runs = [...input.runs].sort((left, right) =>
    getRunSnapshotTimestamp(left).localeCompare(getRunSnapshotTimestamp(right)),
  );
  const publishedSignals = input.signals.filter(isPublishedSignal);
  const publishedIntels = input.intels.filter(isPublishedIntel);
  const posts = input.posts ?? [];
  const publishedSignalsByRunId = groupByRunId(publishedSignals);
  const publishedIntelsByRunId = groupByRunId(publishedIntels);
  const postsByRunId = groupByRunId(posts);
  const cumulativeSignals: Signal[] = [];
  const cumulativeIntels: Intel[] = [];
  const cumulativePosts: OutboundPost[] = [];
  const snapshots: AnalyticsSnapshot[] = [];
  let completedRuns = 0;

  for (const run of runs) {
    if (run.status === "completed") {
      completedRuns += 1;
    }

    cumulativeSignals.push(...(publishedSignalsByRunId.get(run.id) ?? []));
    cumulativeIntels.push(...(publishedIntelsByRunId.get(run.id) ?? []));
    cumulativePosts.push(...(postsByRunId.get(run.id) ?? []));

    const tokenFrequency = projectTokenFrequency({
      signals: cumulativeSignals,
      intels: cumulativeIntels,
    });
    const confidenceBands = projectConfidenceBands([
      ...cumulativeSignals,
      ...cumulativeIntels,
    ]);
    const performanceTotals = projectPerformanceTotals(cumulativeSignals);

    snapshots.push(
      analyticsSnapshotSchema.parse({
        id: `analytics-${run.id}`,
        runId: run.id,
        generatedAt: getRunSnapshotTimestamp(run),
        totals: {
          totalRuns: snapshots.length + 1,
          completedRuns,
          publishedSignals: cumulativeSignals.length,
          publishedIntel: cumulativeIntels.length,
          ...projectPostingTotals(cumulativePosts),
          ...performanceTotals,
        },
        confidenceBands,
        tokenFrequency,
        mindshare: projectMindshareSummary(tokenFrequency),
        winRate: projectWinRate(cumulativeSignals),
      }),
    );
  }

  return snapshots;
};

export const buildAnalyticsSnapshotsReadModel = async (
  input: AnalyticsSnapshotsReadModelInput,
): Promise<Result<AnalyticsSnapshot[], RepositoryError>> => {
  if (!isPersistenceConfigured(input.env)) {
    return ok(demoAnalyticsSnapshots);
  }

  const repositories = createRepositories(input.env);
  const [runs, signals, intels, posts] = await Promise.all([
    repositories.runs.listRecentRuns(MAX_RECORDS),
    repositories.signals.listRecentSignals(MAX_RECORDS),
    repositories.intels.listRecentIntel(MAX_RECORDS),
    repositories.posts.listRecentPosts(MAX_RECORDS),
  ]);

  if (!runs.ok) {
    return runs;
  }

  if (!signals.ok) {
    return signals;
  }

  if (!intels.ok) {
    return intels;
  }

  if (!posts.ok) {
    return posts;
  }

  return ok(
    projectAnalyticsSnapshots({
      runs: runs.value,
      signals: signals.value,
      intels: intels.value,
      posts: posts.value,
    }),
  );
};

export const buildLatestAnalyticsSnapshotReadModel = async (
  input: AnalyticsSnapshotsReadModelInput,
): Promise<Result<AnalyticsSnapshot | null, RepositoryError>> => {
  const snapshots = await buildAnalyticsSnapshotsReadModel(input);

  if (!snapshots.ok) {
    return snapshots;
  }

  return ok(snapshots.value[snapshots.value.length - 1] ?? null);
};
