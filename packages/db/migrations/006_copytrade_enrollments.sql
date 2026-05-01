CREATE TABLE IF NOT EXISTS public.copytrade_enrollments (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  wallet_address text NOT NULL,
  hyperliquid_chain text NOT NULL CHECK (hyperliquid_chain = ANY (ARRAY['Mainnet'::text, 'Testnet'::text])),
  signature_chain_id text NOT NULL,
  agent_address text NOT NULL,
  agent_name text NOT NULL,
  encrypted_agent_private_key text NOT NULL,
  risk_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status = ANY (ARRAY['pending_approval'::text, 'active'::text, 'paused'::text, 'revoked'::text, 'approval_failed'::text])),
  approval_nonce bigint NOT NULL,
  approval_response jsonb,
  last_error text,
  approved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT copytrade_enrollments_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS copytrade_enrollments_wallet_status_idx
  ON public.copytrade_enrollments (wallet_address, status, created_at DESC);
