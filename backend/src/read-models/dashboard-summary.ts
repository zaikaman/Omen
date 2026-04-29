import {
  IntelsRepository,
  OutboundPostsRepository,
  RunsRepository,
  SignalsRepository,
  createSupabaseServiceRoleClient,
  type RepositoryError,
} from "@omen/db";
import { err, ok, type DashboardSummary, type Result, type SchedulerStatus } from "@omen/shared";

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

export const buildDashboardSummaryReadModel = async (
  input: DashboardSummaryReadModelInput,
): Promise<Result<DashboardSummary, RepositoryError>> => {
  if (!isPersistenceConfigured(input.env)) {
    return err({
      code: "PERSISTENCE_NOT_CONFIGURED",
      details: null,
      hint: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      message: "Dashboard summary requires a configured Supabase persistence backend.",
    });
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
