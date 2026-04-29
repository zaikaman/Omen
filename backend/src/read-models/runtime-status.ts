import {
  RunsRepository,
  createSupabaseServiceRoleClient,
  type RepositoryError,
} from "@omen/db";
import {
  err,
  ok,
  runtimeModeSchema,
  schedulerStatusSchema,
  type Result,
  type RunListItem,
  type RuntimeMode,
  type SchedulerStatus,
} from "@omen/shared";

import type { BackendEnv } from "../bootstrap/env.js";
import { presentRunListItem } from "../presenters/dashboard.presenter.js";

type RuntimeStatusReadModelEnv = Pick<BackendEnv, "supabase">;

export type RuntimeStatusReadModel = {
  runtimeMode: RuntimeMode;
  scheduler: SchedulerStatus;
  activeRun: RunListItem | null;
  latestRun: RunListItem | null;
  lastCompletedRunId: string | null;
};

export type RuntimeStatusReadModelInput = {
  env: RuntimeStatusReadModelEnv;
  runtimeMode: RuntimeMode;
  scheduler: SchedulerStatus;
};

const isPersistenceConfigured = (env: RuntimeStatusReadModelEnv) =>
  Boolean(env.supabase.url && env.supabase.serviceRoleKey);

const createRunsRepository = (env: RuntimeStatusReadModelEnv) => {
  const client = createSupabaseServiceRoleClient({
    url: env.supabase.url ?? "",
    anonKey: env.supabase.anonKey ?? env.supabase.serviceRoleKey ?? "",
    serviceRoleKey: env.supabase.serviceRoleKey ?? "",
    schema: env.supabase.schema,
  });

  return new RunsRepository(client);
};

export const buildRuntimeStatusReadModel = async (
  input: RuntimeStatusReadModelInput,
): Promise<Result<RuntimeStatusReadModel, RepositoryError>> => {
  if (!isPersistenceConfigured(input.env)) {
    return err({
      code: "PERSISTENCE_NOT_CONFIGURED",
      details: null,
      hint: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      message: "Runtime status requires a configured Supabase persistence backend.",
    });
  }

  const runsRepository = createRunsRepository(input.env);
  const [activeRun, latestRun, recentRuns] = await Promise.all([
    runsRepository.findActiveRun(),
    runsRepository.findLatestRun(),
    runsRepository.listRecentRuns(20),
  ]);

  if (!activeRun.ok) {
    return activeRun;
  }

  if (!latestRun.ok) {
    return latestRun;
  }

  if (!recentRuns.ok) {
    return recentRuns;
  }

  return ok({
    runtimeMode: runtimeModeSchema.parse(input.runtimeMode),
    scheduler: schedulerStatusSchema.parse(input.scheduler),
    activeRun: presentRunListItem(activeRun.value),
    latestRun: presentRunListItem(latestRun.value),
    lastCompletedRunId:
      recentRuns.value.find((run) => run.completedAt !== null)?.id ?? null,
  });
};
