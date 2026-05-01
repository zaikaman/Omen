ALTER TABLE public.signals
  DROP CONSTRAINT IF EXISTS signals_check;

ALTER TABLE public.signals
  ADD CONSTRAINT signals_check
  CHECK (
    direction NOT IN ('LONG', 'SHORT')
    OR confidence >= 80
  );
