ALTER TABLE public.copytrade_trades
  ADD COLUMN IF NOT EXISTS take_profit_order_id text,
  ADD COLUMN IF NOT EXISTS stop_loss_order_id text,
  ADD COLUMN IF NOT EXISTS execution_metadata jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS copytrade_trades_enrollment_signal_uidx
  ON public.copytrade_trades (enrollment_id, signal_id)
  WHERE signal_id IS NOT NULL;
