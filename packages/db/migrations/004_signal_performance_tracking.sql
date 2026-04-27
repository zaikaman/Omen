alter table public.signals
  add column if not exists signal_status text check (signal_status in ('pending', 'active', 'tp_hit', 'sl_hit', 'closed'));

alter table public.signals
  add column if not exists pnl_percent numeric;

alter table public.signals
  add column if not exists closed_at timestamp with time zone;

alter table public.signals
  add column if not exists price_updated_at timestamp with time zone;

create index if not exists signals_tracking_idx
  on public.signals (report_status, direction, signal_status, published_at desc);
