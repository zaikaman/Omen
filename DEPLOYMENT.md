# Omen Deployment Notes

## Recommended production split

- `frontend` -> Vercel
- `backend` -> Heroku
- scheduled swarm execution -> Heroku Scheduler
- remote AXL node bridge -> separate host with a public HTTPS endpoint

## Why this split

- Vercel is a good fit for the static React dashboard and read-only API consumption.
- Heroku is a better fit for the Express backend and hourly swarm execution.
- Vercel Cron triggers Vercel Functions in the same project, but Omen's long-lived scheduler and live provider runtime are better treated as backend infrastructure.
- Heroku Scheduler gives a cleaner hourly execution model than relying on an in-memory interval inside a dyno.

## Vercel project

Use `frontend` as the Vercel project root.

Committed config:

- [frontend/vercel.json](/D:/Omen/frontend/vercel.json)
- [deploy/env/vercel.frontend.env.example](/D:/Omen/deploy/env/vercel.frontend.env.example)

Required production env:

```bash
VITE_API_BASE_URL=https://<your-heroku-backend-domain>/api
```

## Heroku app

Deploy from the repo root.

- `Procfile` starts the backend app.
- `heroku-postbuild` only builds the backend package.
- [app.json](/D:/Omen/app.json) captures the expected Heroku env surface.
- [deploy/env/heroku.backend.env.example](/D:/Omen/deploy/env/heroku.backend.env.example) is the copyable backend env template.

Recommended dyno/process model:

- `web` dyno: `pnpm start:backend`
- Heroku Scheduler job every hour: `cd backend && pnpm run:scheduled`

Suggested setup:

```bash
heroku create your-omen-backend
heroku buildpacks:set heroku/nodejs
heroku config:set NODE_ENV=production LOG_LEVEL=info RUNTIME_MODE=production_like ALLOW_CONCURRENT_RUNS=false SCHEDULER_ENABLED=false
```

Recommended production env:

```bash
NODE_ENV=production
LOG_LEVEL=info
RUNTIME_MODE=production_like
ALLOW_CONCURRENT_RUNS=false
SCHEDULER_ENABLED=false

FRONTEND_URL=https://<your-vercel-domain>
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_KEY=<service-role-key>

OPENAI_API_KEY=<key>
OPENAI_BASE_URL=<openai-compatible-base-url>
OPENAI_MODEL=gpt-5-nano

SCANNER_API_KEY=<key>
SCANNER_BASE_URL=https://v98store.com/v1
SCANNER_MODEL=grok-4-fast

TAVILY_API_KEY=<key>
COINGECKO_API_KEY=<optional-key>

TWITTERAPI_BASE_URL=https://api.twitterapi.io
TWITTERAPI_API_KEY=<key>
TWITTERAPI_LOGIN_COOKIES=<cookies>
TWITTERAPI_PROXY=<proxy>

AXL_NODE_BASE_URL=https://<your-remote-axl-bridge-domain>
AXL_API_TOKEN=<shared-secret-if-you-protect-the-bridge>
AXL_ORCHESTRATOR_NODE_ID=omen-orchestrator
AXL_SCANNER_NODE_ID=omen-scanner
AXL_RESEARCH_NODE_ID=omen-research
AXL_ANALYST_NODE_ID=omen-analyst
AXL_CRITIC_NODE_ID=omen-critic

ZERO_G_RPC_URL=https://evmrpc-testnet.0g.ai
ZERO_G_INDEXER_URL=https://indexer-storage-testnet-turbo.0g.ai
ZERO_G_COMPUTE_URL=<your-0g-compute-endpoint>
```

## Remote AXL node bridge

The AXL node's HTTP API defaults to `127.0.0.1`, which is local-only. For remote Omen backend access:

1. Run the Go node on a separate host.
2. Bind the HTTP bridge to a reachable interface instead of localhost.
3. Put the bridge behind HTTPS and auth at the reverse-proxy layer.
4. Point `AXL_NODE_BASE_URL` at that public bridge URL.

Committed Fly deployment files:

- [deploy/fly/axl.fly.toml](/D:/Omen/deploy/fly/axl.fly.toml)
- [deploy/fly/axl.Dockerfile](/D:/Omen/deploy/fly/axl.Dockerfile)
- [deploy/fly/axl-entrypoint.sh](/D:/Omen/deploy/fly/axl-entrypoint.sh)
- [deploy/env/fly.axl.env.example](/D:/Omen/deploy/env/fly.axl.env.example)

Useful AXL config concepts from the local docs:

- `bridge_addr` controls the HTTP bind address
- `api_port` controls the HTTP API port
- `Listen` is needed if the node is acting as a public peer
- `router_addr` and `a2a_addr` enable MCP and A2A forwarding

Suggested shape:

```json
{
  "PrivateKeyPath": "private.pem",
  "Peers": ["tls://<bootstrap-peer>:9001"],
  "Listen": ["tls://0.0.0.0:9001"],
  "bridge_addr": "0.0.0.0",
  "api_port": 9002,
  "router_addr": "http://127.0.0.1",
  "router_port": 9003,
  "a2a_addr": "http://127.0.0.1",
  "a2a_port": 9004
}
```

Then expose only the reverse-proxied HTTPS bridge externally, not the raw local Python services.

Suggested Fly bootstrap:

```bash
fly apps create omen-axl-node
fly volumes create axl_data --size 1 --region sin --app omen-axl-node
fly secrets set AXL_PRIVATE_KEY_B64=<base64-pem> --app omen-axl-node
fly deploy -c deploy/fly/axl.fly.toml
```

The committed Fly image currently deploys the Go node bridge only. It does not yet bundle the Python MCP router or A2A sidecars. That is acceptable for Omen's current live runtime, because the backend currently uses the bridge for `/topology` and `/send`. If you want remote `/mcp` or `/a2a` later, extend the Fly image with those sidecars.
