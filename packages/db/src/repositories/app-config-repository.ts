import {
  err,
  ok,
  runtimeConfigSchema,
  type Result,
  type RuntimeConfig,
} from "@omen/shared";

import {
  BaseRepository,
  type RepositoryError,
} from "./base-repository.js";
import type { OmenSupabaseClient } from "../client/supabase.js";

type AppConfigRow = {
  id: string;
  mode: RuntimeConfig["mode"];
  market_universe: RuntimeConfig["marketUniverse"];
  quality_thresholds: RuntimeConfig["qualityThresholds"];
  providers: RuntimeConfig["providers"];
  paper_trading_enabled: boolean;
  testnet_execution_enabled: boolean;
  mainnet_execution_enabled: boolean;
  post_to_x_enabled: boolean;
  scan_interval_minutes: number;
  updated_at: string;
};

type AppConfigInsert = {
  id?: string;
  mode: RuntimeConfig["mode"];
  market_universe: RuntimeConfig["marketUniverse"];
  quality_thresholds: RuntimeConfig["qualityThresholds"];
  providers: RuntimeConfig["providers"];
  paper_trading_enabled: boolean;
  testnet_execution_enabled: boolean;
  mainnet_execution_enabled: boolean;
  post_to_x_enabled: boolean;
  scan_interval_minutes: number;
  updated_at?: string;
};

type AppConfigUpdate = Partial<AppConfigInsert>;

const toRuntimeConfig = (row: AppConfigRow): RuntimeConfig =>
  runtimeConfigSchema.parse({
    id: row.id,
    mode: row.mode,
    marketUniverse: row.market_universe,
    qualityThresholds: row.quality_thresholds,
    providers: row.providers,
    paperTradingEnabled: row.paper_trading_enabled,
    testnetExecutionEnabled: row.testnet_execution_enabled,
    mainnetExecutionEnabled: row.mainnet_execution_enabled,
    postToXEnabled: row.post_to_x_enabled,
    scanIntervalMinutes: row.scan_interval_minutes,
    updatedAt: row.updated_at,
  });

const toInsertRow = (config: RuntimeConfig): AppConfigInsert => ({
  id: config.id,
  mode: config.mode,
  market_universe: config.marketUniverse,
  quality_thresholds: config.qualityThresholds,
  providers: config.providers,
  paper_trading_enabled: config.paperTradingEnabled,
  testnet_execution_enabled: config.testnetExecutionEnabled,
  mainnet_execution_enabled: config.mainnetExecutionEnabled,
  post_to_x_enabled: config.postToXEnabled,
  scan_interval_minutes: config.scanIntervalMinutes,
  updated_at: config.updatedAt,
});

const toUpdateRow = (patch: Partial<RuntimeConfig>): AppConfigUpdate => ({
  mode: patch.mode,
  market_universe: patch.marketUniverse,
  quality_thresholds: patch.qualityThresholds,
  providers: patch.providers,
  paper_trading_enabled: patch.paperTradingEnabled,
  testnet_execution_enabled: patch.testnetExecutionEnabled,
  mainnet_execution_enabled: patch.mainnetExecutionEnabled,
  post_to_x_enabled: patch.postToXEnabled,
  scan_interval_minutes: patch.scanIntervalMinutes,
  updated_at: patch.updatedAt,
});

export class AppConfigRepository extends BaseRepository<
  AppConfigRow,
  AppConfigInsert,
  AppConfigUpdate
> {
  constructor(client: OmenSupabaseClient) {
    super(client, "app_config");
  }

  async getConfig(id = "default"): Promise<Result<RuntimeConfig | null, RepositoryError>> {
    const found = await this.findById(id);

    if (!found.ok) {
      return found;
    }

    return ok(found.value ? toRuntimeConfig(found.value) : null);
  }

  async saveConfig(config: RuntimeConfig): Promise<Result<RuntimeConfig, RepositoryError>> {
    const saved = await this.upsertOne(toInsertRow(config), {
      onConflict: "id",
    });

    if (!saved.ok) {
      return saved;
    }

    return ok(toRuntimeConfig(saved.value));
  }

  async updateConfig(
    id: string,
    patch: Partial<RuntimeConfig>,
  ): Promise<Result<RuntimeConfig, RepositoryError>> {
    const updated = await this.updateById(id, toUpdateRow(patch));

    if (!updated.ok) {
      return updated;
    }

    return ok(toRuntimeConfig(updated.value));
  }

  async requireConfig(id = "default"): Promise<Result<RuntimeConfig, RepositoryError>> {
    const config = await this.getConfig(id);

    if (!config.ok) {
      return config;
    }

    if (!config.value) {
      return err({
        code: "CONFIG_NOT_FOUND",
        details: null,
        hint: null,
        message: `Runtime config ${id} was not found.`,
      });
    }

    return ok(config.value);
  }
}
