alter table public.signals
  add column if not exists order_type text check (order_type in ('market', 'limit'));

alter table public.signals
  add column if not exists trading_style text check (trading_style in ('day_trade', 'swing_trade'));

alter table public.signals
  add column if not exists expected_duration text;

alter table public.signals
  add column if not exists current_price numeric;

alter table public.signals
  add column if not exists entry_price numeric;

alter table public.signals
  add column if not exists target_price numeric;

alter table public.signals
  add column if not exists stop_loss numeric;
