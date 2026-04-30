# Omen Deployment

This repo is set up for a split deployment:

- Frontend: Vercel
- Backend API: Heroku
- Hourly swarm execution: backend in-process scheduler
- Optional remote AXL bridge: separate host, such as Fly.io

## Frontend on Vercel

Create a Vercel project for the `frontend` directory only.

In the Vercel import screen:

- Select the `frontend` app entry, not the repo root.
- Set Root Directory to `frontend`.
- Leave the backend out of the Vercel project entirely.

Committed frontend config:

- [frontend/vercel.json](/D:/Omen/frontend/vercel.json)

Build behavior inside that project:

```bash
cd .. && pnpm --filter omen-frontend build
```

It serves the output from:

```bash
dist
```

Required Vercel environment variable:

```bash
VITE_API_BASE_URL=https://<your-heroku-app>.herokuapp.com/api
```

After the Heroku backend is deployed, update `VITE_API_BASE_URL` to the final Heroku app URL and redeploy the Vercel project.

## Backend on Heroku

Deploy Heroku from the repository root.

Committed Heroku files:

- [Procfile](/D:/Omen/Procfile)
- [app.json](/D:/Omen/app.json)
- [backend/.env.example](/D:/Omen/backend/.env.example)

The web dyno runs:

```bash
pnpm start:backend
```

The root `heroku-postbuild` script builds the backend package before the dyno starts.

Suggested setup:

```bash
heroku create <your-heroku-app>
heroku buildpacks:set heroku/nodejs --app <your-heroku-app>
heroku config:set NODE_ENV=production LOG_LEVEL=info RUNTIME_MODE=production_like ALLOW_CONCURRENT_RUNS=false SCHEDULER_ENABLED=true --app <your-heroku-app>
```

Set the remaining backend environment variables from:

```bash
backend/.env.example
```

At minimum, production needs:

```bash
FRONTEND_URL=https://<your-vercel-app>.vercel.app
FRONTEND_ORIGIN=https://<your-vercel-app>.vercel.app
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
OPENAI_API_KEY=<key>
SCANNER_API_KEY=<key>
TAVILY_API_KEY=<key>
TWITTERAPI_API_KEY=<key>
AXL_NODE_BASE_URL=https://<your-remote-axl-bridge>
ZERO_G_RPC_URL=https://evmrpc-testnet.0g.ai
ZERO_G_INDEXER_URL=https://indexer-storage-testnet-turbo.0g.ai
ZERO_G_KV_NODE_URL=<your-0g-kv-node>
ZERO_G_COMPUTE_URL=<your-0g-compute-endpoint>
ZERO_G_COMPUTE_API_KEY=<key>
ZERO_G_PRIVATE_KEY=<wallet-private-key>
ZERO_G_RUN_REGISTRY_ADDRESS=<deployed OmenRunRegistry address>
```

Deploy the run registry once before enabling chain anchoring:

```bash
pnpm --filter @omen/zero-g deploy:run-registry
```

The deploy script prints the contract address. Set that value as `ZERO_G_RUN_REGISTRY_ADDRESS` on Heroku.

`PORT` is supplied by Heroku. Do not hard-code it in Heroku config unless you are debugging locally.

## Hourly Scheduler

Set this on the Heroku web dyno:

```bash
SCHEDULER_ENABLED=true
```

The backend already starts an in-process hourly scheduler when that flag is enabled. It schedules the first run one hour after the dyno boots, then continues every hour while the dyno is alive.

Do not install Heroku Scheduler for the normal production setup.

Important Heroku caveat: Heroku dynos are restarted at least once per day, and deploys/config changes also restart the dyno. After a restart, the in-process scheduler starts fresh and the next run is one hour after boot. That means this setup is simple and fine for hourly background work, but it is not an exact wall-clock scheduler and can miss a run if the dyno is down or sleeping.

For this setup, use a non-sleeping dyno type. If the web dyno sleeps, the in-process scheduler sleeps with it.

Manual one-off run, if needed:

```bash
pnpm --dir backend run:scheduled:prod
```

This uses the compiled JavaScript emitted during `heroku-postbuild`, so it does not depend on TypeScript dev tooling being present at runtime.

## CORS

The backend allows browser requests from `FRONTEND_ORIGIN`, falling back to `FRONTEND_URL`.

Use the exact Vercel origin, for example:

```bash
FRONTEND_ORIGIN=https://omen.example.vercel.app
```

Do not include a trailing `/api` path in `FRONTEND_ORIGIN`.

## Env Files

Local env files are package-scoped.

Package templates:

- Frontend local/Vercel: [frontend/.env.example](/D:/Omen/frontend/.env.example)
- Backend local/Heroku: [backend/.env.example](/D:/Omen/backend/.env.example)
- Fly AXL bridge: [deploy/env/fly.axl.env.example](/D:/Omen/deploy/env/fly.axl.env.example)

Use `SUPABASE_SERVICE_ROLE_KEY` for backend Supabase service access.

## Optional AXL Bridge

The backend expects `AXL_NODE_BASE_URL` to point at a reachable AXL HTTP bridge. If the bridge runs on another host, bind it to a reachable interface, put it behind HTTPS/auth, and expose only the reverse-proxied endpoint.

Existing Fly.io helper files:

- [deploy/fly/axl.fly.toml](/D:/Omen/deploy/fly/axl.fly.toml)
- [deploy/fly/axl.Dockerfile](/D:/Omen/deploy/fly/axl.Dockerfile)
- [deploy/fly/axl-entrypoint.sh](/D:/Omen/deploy/fly/axl-entrypoint.sh)

Suggested Fly bootstrap:

```bash
fly apps create omen-axl-node
fly volumes create axl_data --size 1 --region sin --app omen-axl-node
fly secrets set AXL_PRIVATE_KEY_B64=<base64-pem> --app omen-axl-node
fly deploy -c deploy/fly/axl.fly.toml
```

Then set this on Heroku:

```bash
AXL_NODE_BASE_URL=https://<your-fly-axl-app>.fly.dev
```

## Verification

Before deploying:

```bash
pnpm install --frozen-lockfile
pnpm --filter omen-frontend build
pnpm --filter omen-backend build
```

After deploying:

```bash
curl https://<your-heroku-app>.herokuapp.com/
curl https://<your-heroku-app>.herokuapp.com/api/health
```

Then open the Vercel app and confirm browser requests go to:

```bash
https://<your-heroku-app>.herokuapp.com/api
```
