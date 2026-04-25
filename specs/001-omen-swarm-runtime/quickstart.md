# Quickstart: Omen Autonomous Market-Intelligence Swarm

## Goal

Run Omen locally in deterministic demo mode with:
- the React + Vite frontend
- the separate Node.js backend/runtime
- local Supabase
- multiple AXL nodes
- 0G adapters configured for real or fallback development mode

## Prerequisites

- Node.js 22 LTS
- pnpm 10+
- Docker Desktop or compatible container runtime for local Supabase
- Go toolchain if building local AXL nodes from source
- Access to required environment variables for Supabase and optional 0G/Hyperliquid integrations

## Workspace bootstrap

```bash
pnpm install
pnpm build
```

## Environment setup

1. Copy root and package-level example environment files if present.
2. Set demo-safe defaults:
   - `OMEN_RUNTIME_MODE=mocked`
   - `OMEN_EXECUTION_MODE=paper`
   - `OMEN_ENABLE_MAINNET_EXECUTION=false`
3. Configure Supabase connection values.
4. Add 0G testnet credentials and endpoints if available.
5. Add Hyperliquid read-only or testnet settings if available.
6. Set `FRONTEND_ORIGIN=http://localhost:5173` for the backend if local CORS needs to be explicit.

## Start local infrastructure

### 1. Start Supabase and apply migrations

```bash
pnpm supabase:start
pnpm db:migrate
pnpm db:seed
```

### 2. Start AXL nodes

Run at least three local AXL nodes so the backend/runtime can assign roles across peers.

```bash
pnpm axl:start:orchestrator
pnpm axl:start:scanner
pnpm axl:start:research
pnpm axl:start:analyst
pnpm axl:start:critic
```

### 3. Start the backend/runtime

```bash
pnpm --dir backend dev
```

Expected behavior:
- backend connects to Supabase
- backend registers node status
- backend exposes its API and runtime command trigger channel
- backend reports ready state

### 4. Start the frontend

```bash
pnpm --dir frontend dev
```

Open the local frontend URL shown by Vite, typically `http://localhost:5173`.

## Run the demo

1. Open `Mission Control`.
2. Confirm node status is visible.
3. Start a demo run.
4. Watch the live trace populate with:
   - run creation
   - market bias output
   - candidate discovery
   - AXL message events
   - 0G KV/log reference events
   - thesis generation
   - critic decision
   - final publication
   - paper position and monitor updates where applicable
5. Open `Signals` and then a signal detail page to inspect the final report and references.

## Verification checklist

- Frontend loads locally.
- Backend/runtime is running in a separate process.
- Start-demo returns quickly and does not hang on long-running work.
- At least four specialist agents appear in the trace.
- At least three AXL node communications are recorded.
- 0G references are visible in Mission Control or Trace.
- Final output is either an approved signal or a no high-conviction report.
- Output includes disclaimer, invalidation, confidence, and critic result.

## Troubleshooting

- If AXL nodes are offline, switch to deterministic mocked demo mode only for non-sponsor-critical local development and treat it as degraded.
- If 0G credentials are missing, use the clearly flagged development fallback path and verify that the UI labels the mode correctly.
- If market providers rate-limit, keep the runtime in mocked mode and use seeded fixtures.
- If realtime updates lag, verify Supabase realtime or the selected SSE/WebSocket transport before debugging agent logic.
- If frontend dependency resolution fails, run `pnpm install` at the repo root and `npm install` inside `frontend` only when you explicitly want a local npm lockfile for direct `npm run dev` usage.
