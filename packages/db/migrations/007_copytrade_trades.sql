CREATE TABLE IF NOT EXISTS public.copytrade_trades (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  enrollment_id text NOT NULL,
  wallet_address text NOT NULL,
  signal_id text,
  asset text NOT NULL,
  direction text NOT NULL CHECK (direction = ANY (ARRAY['LONG'::text, 'SHORT'::text])),
  status text NOT NULL CHECK (status = ANY (ARRAY['queued'::text, 'open'::text, 'closed'::text, 'failed'::text, 'skipped'::text])),
  order_id text,
  entry_price numeric,
  exit_price numeric,
  quantity numeric,
  leverage numeric,
  notional_usd numeric,
  pnl_usd numeric,
  pnl_percent numeric,
  opened_at timestamp with time zone,
  closed_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT copytrade_trades_pkey PRIMARY KEY (id),
  CONSTRAINT copytrade_trades_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.copytrade_enrollments(id),
  CONSTRAINT copytrade_trades_signal_id_fkey FOREIGN KEY (signal_id) REFERENCES public.signals(id)
);

CREATE INDEX IF NOT EXISTS copytrade_trades_wallet_created_idx
  ON public.copytrade_trades (wallet_address, created_at DESC);

CREATE INDEX IF NOT EXISTS copytrade_trades_enrollment_status_idx
  ON public.copytrade_trades (enrollment_id, status, created_at DESC);
