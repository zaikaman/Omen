ALTER TABLE public.copytrade_trades
  DROP CONSTRAINT IF EXISTS copytrade_trades_signal_id_fkey;

ALTER TABLE public.copytrade_trades
  ADD CONSTRAINT copytrade_trades_signal_id_fkey
  FOREIGN KEY (signal_id)
  REFERENCES public.signals(id)
  ON DELETE SET NULL;
