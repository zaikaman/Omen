import {
  IntelsRepository,
  OutboundPostsRepository,
  RunsRepository,
  SignalsRepository,
  createSupabaseServiceRoleClient,
  demoAnalyticsSnapshots,
  demoRunBundles,
  type RepositoryError,
} from "@omen/db";
import { ok, type DashboardSummary, type Result, type SchedulerStatus } from "@omen/shared";

import type { BackendEnv } from "../bootstrap/env.js";
import { presentDashboardSummary } from "../presenters/dashboard.presenter.js";
import { buildLatestAnalyticsSnapshotReadModel } from "./analytics-snapshots.js";

type DashboardSummaryReadModelEnv = Pick<BackendEnv, "supabase">;

export type DashboardSummaryReadModelInput = {
  env: DashboardSummaryReadModelEnv;
  scheduler: SchedulerStatus;
};

const isPersistenceConfigured = (env: DashboardSummaryReadModelEnv) =>
  Boolean(env.supabase.url && env.supabase.serviceRoleKey);

const createRepositories = (env: DashboardSummaryReadModelEnv) => {
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
    outboundPosts: new OutboundPostsRepository(client),
  };
};

const buildDemoDashboardSummary = (scheduler: SchedulerStatus): DashboardSummary => {
  const latestRunBundle = demoRunBundles[demoRunBundles.length - 1] ?? null;
  const latestSignalBundle = [...demoRunBundles]
    .reverse()
    .find((bundle) => bundle.signal !== null);
  const latestIntelBundle = [...demoRunBundles]
    .reverse()
    .find((bundle) => bundle.intel !== null);
  const latestPost =
    [...demoRunBundles]
      .flatMap((bundle) => bundle.outboundPosts)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
  const latestAnalytics =
    demoAnalyticsSnapshots[demoAnalyticsSnapshots.length - 1] ?? null;

  return presentDashboardSummary({
    activeRun: null,
    latestRun: latestRunBundle?.run ?? null,
    latestSignalId: latestSignalBundle?.signal?.id ?? null,
    latestIntelId: latestIntelBundle?.intel?.id ?? null,
    scheduler,
    latestPost,
    analytics: latestAnalytics,
  });
};

export const buildDashboardSummaryReadModel = async (
  input: DashboardSummaryReadModelInput,
): Promise<Result<DashboardSummary, RepositoryError>> => {
  if (!isPersistenceConfigured(input.env)) {
    return ok(buildDemoDashboardSummary(input.scheduler));
  }

  const repositories = createRepositories(input.env);
  const [activeRun, latestRun, latestSignal, latestIntel, latestAnalytics, recentPosts] =
    await Promise.all([
      repositories.runs.findActiveRun(),
      repositories.runs.findLatestRun(),
      repositories.signals.findLatestPublished(),
      repositories.intels.findLatestPublished(),
      buildLatestAnalyticsSnapshotReadModel({ env: input.env }),
      repositories.outboundPosts.listRecentPosts(1),
    ]);

  if (!activeRun.ok) {
    return activeRun;
  }

  if (!latestRun.ok) {
    return latestRun;
  }

  if (!latestSignal.ok) {
    return latestSignal;
  }

  if (!latestIntel.ok) {
    return latestIntel;
  }

  if (!latestAnalytics.ok) {
    return latestAnalytics;
  }

  if (!recentPosts.ok) {
    return recentPosts;
  }

  return ok(
    presentDashboardSummary({
      activeRun: activeRun.value,
      latestRun: latestRun.value,
      latestSignalId: latestSignal.value?.id ?? null,
      latestIntelId: latestIntel.value?.id ?? null,
      scheduler: input.scheduler,
      latestPost: recentPosts.value[0] ?? null,
      analytics: latestAnalytics.value,
    }),
  );
};
