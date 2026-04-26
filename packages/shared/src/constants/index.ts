export const OMEN_DISCLAIMER =
  "Omen market intelligence is for informational purposes only and is not financial advice.";

export const RUN_STATUS_VALUES = [
  "queued",
  "starting",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export const RUNTIME_MODE_VALUES = [
  "mocked",
  "live",
  "production_like",
] as const;

export const RUN_TRIGGER_VALUES = ["dashboard", "scheduler", "system"] as const;

export const MARKET_BIAS_VALUES = ["LONG", "SHORT", "NEUTRAL", "UNKNOWN"] as const;

export const SIGNAL_DIRECTION_VALUES = [
  "LONG",
  "SHORT",
  "WATCHLIST",
  "NONE",
] as const;

export const CRITIC_DECISION_VALUES = [
  "approved",
  "rejected",
  "watchlist_only",
] as const;

export const REPORT_STATUS_VALUES = ["draft", "published", "superseded"] as const;

export const POST_STATUS_VALUES = [
  "queued",
  "formatting",
  "ready",
  "posting",
  "posted",
  "failed",
] as const;

export const EVENT_STATUS_VALUES = [
  "info",
  "success",
  "warning",
  "error",
  "pending",
] as const;

export const AXL_TRANSPORT_KIND_VALUES = ["send", "a2a", "mcp"] as const;

export const AXL_DELIVERY_STATUS_VALUES = [
  "queued",
  "sent",
  "received",
  "failed",
] as const;

export const PROOF_REF_TYPE_VALUES = [
  "kv_state",
  "log_entry",
  "log_bundle",
  "file_artifact",
  "compute_job",
  "compute_result",
  "post_payload",
  "post_result",
  "manifest",
  "chain_proof",
] as const;

export * from "./tradeable-tokens.js";
