create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.runs (
  id text primary key default gen_random_uuid()::text,
  mode text not null check (mode in ('mocked', 'live', 'production_like')),
  status text not null check (status in ('queued', 'starting', 'running', 'completed', 'failed', 'cancelled')),
  market_bias text not null default 'UNKNOWN' check (market_bias in ('LONG', 'SHORT', 'NEUTRAL', 'UNKNOWN')),
  triggered_by text not null check (triggered_by in ('dashboard', 'scheduler', 'system')),
  active_candidate_count integer not null default 0 check (active_candidate_count >= 0 and active_candidate_count <= 3),
  current_checkpoint_ref_id text,
  final_signal_id text,
  final_intel_id text,
  failure_reason text,
  outcome jsonb,
  config_snapshot jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    status not in ('completed', 'failed', 'cancelled')
    or completed_at is not null
  )
);

create table if not exists public.agent_nodes (
  id text primary key default gen_random_uuid()::text,
  role text not null check (role in ('orchestrator', 'market_bias', 'scanner', 'research', 'chart_vision', 'analyst', 'critic', 'publisher', 'memory', 'monitor')),
  transport text not null check (transport in ('axl', 'local')),
  status text not null check (status in ('starting', 'online', 'degraded', 'offline')),
  peer_id text,
  last_heartbeat_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.zero_g_refs (
  id text primary key default gen_random_uuid()::text,
  run_id text not null references public.runs(id) on delete cascade,
  signal_id text,
  intel_id text,
  ref_type text not null check (ref_type in ('kv_state', 'log_entry', 'log_bundle', 'file_artifact', 'compute_job', 'compute_result', 'post_payload', 'post_result', 'manifest', 'chain_proof')),
  key text,
  locator text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.intels (
  id text primary key default gen_random_uuid()::text,
  run_id text not null references public.runs(id) on delete cascade,
  title text not null,
  slug text not null unique,
  summary text not null,
  body text not null,
  category text not null check (category in ('market_update', 'narrative_shift', 'token_watch', 'macro', 'opportunity')),
  status text not null check (status in ('draft', 'ready', 'published', 'suppressed')),
  symbols jsonb not null default '[]'::jsonb,
  confidence integer not null check (confidence >= 0 and confidence <= 100),
  sources jsonb not null default '[]'::jsonb,
  proof_ref_ids jsonb not null default '[]'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.signals (
  id text primary key default gen_random_uuid()::text,
  run_id text not null references public.runs(id) on delete cascade,
  candidate_id text,
  asset text not null,
  direction text not null check (direction in ('LONG', 'SHORT', 'WATCHLIST', 'NONE')),
  confidence integer not null check (confidence >= 0 and confidence <= 100),
  risk_reward numeric,
  entry_zone jsonb,
  invalidation jsonb,
  targets jsonb not null default '[]'::jsonb,
  why_now text not null,
  confluences jsonb not null default '[]'::jsonb,
  uncertainty_notes text not null,
  missing_data_notes text not null,
  critic_decision text not null check (critic_decision in ('approved', 'rejected', 'watchlist_only')),
  report_status text not null check (report_status in ('draft', 'published', 'superseded')),
  final_report_ref_id text,
  proof_ref_ids jsonb not null default '[]'::jsonb,
  disclaimer text not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    direction not in ('LONG', 'SHORT')
    or confidence >= 85
  ),
  check (
    direction not in ('LONG', 'SHORT')
    or coalesce(risk_reward, 0) >= 2
  )
);

create table if not exists public.agent_events (
  id text primary key default gen_random_uuid()::text,
  run_id text not null references public.runs(id) on delete cascade,
  agent_id text not null references public.agent_nodes(id) on delete restrict,
  agent_role text not null check (agent_role in ('orchestrator', 'market_bias', 'scanner', 'research', 'chart_vision', 'analyst', 'critic', 'publisher', 'memory', 'monitor')),
  event_type text not null check (event_type in ('run_created', 'market_bias_generated', 'candidate_found', 'axl_message_sent', 'axl_message_received', 'zero_g_kv_write', 'zero_g_log_append', 'zero_g_file_published', 'research_completed', 'chart_generated', 'thesis_generated', 'critic_decision', 'report_published', 'intel_ready', 'post_queued', 'warning', 'error')),
  status text not null check (status in ('info', 'success', 'warning', 'error', 'pending')),
  summary text not null,
  payload jsonb not null default '{}'::jsonb,
  timestamp timestamptz not null default now(),
  correlation_id text,
  axl_message_id text,
  proof_ref_id text references public.zero_g_refs(id) on delete set null,
  signal_id text references public.signals(id) on delete set null,
  intel_id text references public.intels(id) on delete set null
);

create table if not exists public.axl_messages (
  id text primary key default gen_random_uuid()::text,
  run_id text not null references public.runs(id) on delete cascade,
  correlation_id text not null,
  from_agent_id text not null references public.agent_nodes(id) on delete restrict,
  from_role text not null check (from_role in ('orchestrator', 'market_bias', 'scanner', 'research', 'chart_vision', 'analyst', 'critic', 'publisher', 'memory', 'monitor')),
  to_agent_id text references public.agent_nodes(id) on delete set null,
  to_role text check (to_role in ('orchestrator', 'market_bias', 'scanner', 'research', 'chart_vision', 'analyst', 'critic', 'publisher', 'memory', 'monitor')),
  topic text,
  message_type text not null,
  payload jsonb not null default '{}'::jsonb,
  transport_kind text not null check (transport_kind in ('send', 'a2a', 'mcp')),
  delivery_status text not null check (delivery_status in ('queued', 'sent', 'received', 'failed')),
  durable_ref_id text references public.zero_g_refs(id) on delete set null,
  timestamp timestamptz not null default now(),
  check (to_agent_id is not null or topic is not null)
);

create table if not exists public.outbound_posts (
  id text primary key default gen_random_uuid()::text,
  run_id text not null references public.runs(id) on delete cascade,
  signal_id text references public.signals(id) on delete set null,
  intel_id text references public.intels(id) on delete set null,
  target text not null check (target in ('x')),
  kind text not null check (kind in ('signal_alert', 'intel_summary', 'intel_thread')),
  status text not null check (status in ('queued', 'formatting', 'ready', 'posting', 'posted', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  provider text not null,
  provider_post_id text,
  published_url text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.analytics_snapshots (
  id text primary key default gen_random_uuid()::text,
  run_id text references public.runs(id) on delete set null,
  generated_at timestamptz not null default now(),
  totals jsonb not null default '{}'::jsonb,
  confidence_bands jsonb not null default '[]'::jsonb,
  token_frequency jsonb not null default '[]'::jsonb,
  mindshare jsonb not null default '[]'::jsonb,
  win_rate numeric
);

create table if not exists public.app_config (
  id text primary key default 'default',
  mode text not null check (mode in ('mocked', 'live', 'production_like')),
  market_universe jsonb not null default '[]'::jsonb,
  quality_thresholds jsonb not null default '{}'::jsonb,
  providers jsonb not null default '{}'::jsonb,
  paper_trading_enabled boolean not null default true,
  testnet_execution_enabled boolean not null default false,
  mainnet_execution_enabled boolean not null default false,
  post_to_x_enabled boolean not null default false,
  scan_interval_minutes integer not null default 60 check (scan_interval_minutes >= 1),
  updated_at timestamptz not null default now(),
  check (mainnet_execution_enabled = false or testnet_execution_enabled = true)
);

create table if not exists public.service_registry_snapshots (
  id text primary key default gen_random_uuid()::text,
  captured_at timestamptz not null default now(),
  source text not null,
  peers jsonb not null default '[]'::jsonb,
  services jsonb not null default '[]'::jsonb,
  routes jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.runs
  add constraint runs_final_signal_id_fkey
  foreign key (final_signal_id)
  references public.signals(id)
  on delete set null;

alter table public.runs
  add constraint runs_final_intel_id_fkey
  foreign key (final_intel_id)
  references public.intels(id)
  on delete set null;

alter table public.runs
  add constraint runs_current_checkpoint_ref_id_fkey
  foreign key (current_checkpoint_ref_id)
  references public.zero_g_refs(id)
  on delete set null;

alter table public.zero_g_refs
  add constraint zero_g_refs_signal_id_fkey
  foreign key (signal_id)
  references public.signals(id)
  on delete set null;

alter table public.zero_g_refs
  add constraint zero_g_refs_intel_id_fkey
  foreign key (intel_id)
  references public.intels(id)
  on delete set null;

alter table public.signals
  add constraint signals_final_report_ref_id_fkey
  foreign key (final_report_ref_id)
  references public.zero_g_refs(id)
  on delete set null;

alter table public.agent_events
  add constraint agent_events_axl_message_id_fkey
  foreign key (axl_message_id)
  references public.axl_messages(id)
  on delete set null;

create index if not exists runs_status_idx on public.runs (status, created_at desc);
create index if not exists runs_mode_idx on public.runs (mode, created_at desc);
create index if not exists agent_nodes_role_status_idx on public.agent_nodes (role, status);
create index if not exists zero_g_refs_run_id_idx on public.zero_g_refs (run_id, created_at desc);
create index if not exists intels_run_id_idx on public.intels (run_id, created_at desc);
create index if not exists intels_slug_idx on public.intels (slug);
create index if not exists signals_run_id_idx on public.signals (run_id, created_at desc);
create index if not exists agent_events_run_id_idx on public.agent_events (run_id, timestamp desc);
create index if not exists agent_events_agent_id_idx on public.agent_events (agent_id, timestamp desc);
create index if not exists axl_messages_run_id_idx on public.axl_messages (run_id, timestamp desc);
create index if not exists axl_messages_correlation_id_idx on public.axl_messages (correlation_id);
create index if not exists outbound_posts_run_id_idx on public.outbound_posts (run_id, created_at desc);
create index if not exists analytics_snapshots_run_id_idx on public.analytics_snapshots (run_id, generated_at desc);
create index if not exists service_registry_snapshots_captured_at_idx on public.service_registry_snapshots (captured_at desc);

drop trigger if exists runs_set_updated_at on public.runs;
create trigger runs_set_updated_at
before update on public.runs
for each row
execute function public.set_updated_at();

drop trigger if exists agent_nodes_set_updated_at on public.agent_nodes;
create trigger agent_nodes_set_updated_at
before update on public.agent_nodes
for each row
execute function public.set_updated_at();

drop trigger if exists intels_set_updated_at on public.intels;
create trigger intels_set_updated_at
before update on public.intels
for each row
execute function public.set_updated_at();

drop trigger if exists signals_set_updated_at on public.signals;
create trigger signals_set_updated_at
before update on public.signals
for each row
execute function public.set_updated_at();

drop trigger if exists outbound_posts_set_updated_at on public.outbound_posts;
create trigger outbound_posts_set_updated_at
before update on public.outbound_posts
for each row
execute function public.set_updated_at();

drop trigger if exists app_config_set_updated_at on public.app_config;
create trigger app_config_set_updated_at
before update on public.app_config
for each row
execute function public.set_updated_at();
