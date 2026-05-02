# Omen

**Autonomous market intelligence, delivered hourly. Every signal traceable. Every report provable.**

Omen is a multi-agent system that scans the crypto market, researches opportunities, generates trading signals and long-form intelligence reports, and publishes them -- all without human intervention. Ten specialized role agents coordinate through a decentralized peer-to-peer network with an orchestrator and a dedicated memory service. Every piece of analysis they produce is backed by verifiable proof stored on decentralized infrastructure.

[Live Dashboard](https://omen-agents.vercel.app) -- [X/Twitter](https://x.com/RealOmenAgent) -- [Telegram Channel](https://t.me/omenagents)

---

## Table of Contents

- [What Omen Does](#what-omen-does)
- [How It Works](#how-it-works)
  - [The Swarm](#the-swarm)
  - [Execution Flow](#execution-flow)
  - [Quality Control](#quality-control)
- [Architecture](#architecture)
  - [System Overview](#system-overview)
  - [Monorepo Layout](#monorepo-layout)
  - [Tech Stack](#tech-stack)
- [Agent Network (AXL)](#agent-network-axl)
  - [Peer-to-Peer Agents](#peer-to-peer-agents)
  - [How Agents Communicate](#how-agents-communicate)
  - [Service Discovery](#service-discovery)
  - [Network Health](#network-health)
- [Proof Infrastructure (0G)](#proof-infrastructure-0g)
  - [Storage](#storage)
  - [Compute Verification](#compute-verification)
  - [On-Chain Anchoring](#on-chain-anchoring)
  - [Proof Pipeline](#proof-pipeline)
- [Intelligent NFT (iNFT)](#intelligent-nft-inft)
- [Smart Contracts](#smart-contracts)
- [Dashboard](#dashboard)
- [API Reference](#api-reference)
- [Copytrade](#copytrade)
- [Data Sources](#data-sources)
- [Database](#database)
- [Publishing](#publishing)
- [Deployment](#deployment)
- [Local Development](#local-development)
- [Configuration](#configuration)
- [Security](#security)
- [AI Tool Attribution](#ai-tool-attribution)
- [License](#license)

---

## What Omen Does

Every hour, Omen wakes up and does the following:

1. **Reads the market** -- Determines the macro directional bias (bullish, bearish, or neutral) from current conditions
2. **Finds opportunities** -- Scans a curated universe of crypto assets for candidates that match the bias
3. **Researches deeply** -- Pulls live data from Binance, CoinGecko, CoinMarketCap, Birdeye, and DeFiLlama
4. **Analyzes charts** -- Generates multi-timeframe technical analysis using vision-capable models
5. **Builds a thesis** -- Synthesizes all evidence into a structured trade thesis with entry, targets, stop loss, and risk/reward
6. **Challenges itself** -- An adversarial critic agent reviews the thesis against quality thresholds and rejects weak signals
7. **Writes intelligence** -- Produces a narrative report explaining the market context, regardless of whether a signal was approved
8. **Publishes everywhere** -- Posts approved signals and reports to X/Twitter, Telegram, and the Omen dashboard
9. **Proves everything** -- Stores all evidence, reasoning, and outputs on decentralized storage and anchors proof hashes on-chain

The result is a continuous stream of market intelligence where every output can be traced back to the specific evidence and reasoning that produced it.

---

## How It Works

### The Swarm

Omen is not a single AI model. It is a coordinated swarm: one orchestrator, ten specialized role agents, and a dedicated memory service. The agents are responsible for the intelligence pipeline:

| Agent | What It Does |
|---|---|
| **Market Bias** | Reads macro conditions and sets the directional bias (LONG / SHORT / NEUTRAL) |
| **Scanner** | Scans the asset universe for candidates aligned with the bias |
| **Research** | Pulls live market data from five providers and assembles structured evidence |
| **Chart Vision** | Renders candlestick charts and analyzes them through a vision model |
| **Analyst** | Synthesizes all evidence into a structured trading thesis |
| **Critic** | Adversarial review -- rejects weak theses, requests repairs, or approves |
| **Intel** | Synthesizes a narrative intelligence report from all available context |
| **Generator** | Transforms the intel report into publishable content formats |
| **Writer** | Produces long-form article content with historical context from memory |
| **Publisher** | Routes the final output -- signal, intel report, or no-conviction -- for publication |

Each agent runs as a separate process with its own network identity. The memory service is also a separate peer process, but it is infrastructure: it exposes recall and persistence tools rather than making autonomous analytical decisions. Agents do not share memory directly; they communicate through encrypted peer-to-peer messages.

**LLM configuration** -- Agents use different models depending on their role and complexity:

| Agent | Primary Model | Fallback Model |
|---|---|---|
| Scanner | Grok-4-fast | Grok-4.1 |
| Research | Gemini-3.1-flash-lite | GPT-5-nano |
| Chart Vision | Gemini-3.1-flash-lite | GPT-5-nano |
| Analyst | Grok-4-fast | Grok-4.1 |
| Critic | Grok-4-fast | Grok-4.1 |
| Intel | Gemini-3.1-flash-lite | GPT-5-nano |
| Generator | Gemini-3.1-flash-lite | GPT-5-nano |
| Writer | Gemini-3.1-flash-lite | GPT-5-nano |
| Market Bias | Grok-4-fast | Grok-4.1 |
| Publisher | Gemini-3.1-flash-lite | GPT-5-nano |
| Adjudication (0G Compute) | Qwen 2.5 7B Instruct | -- |

Fallbacks are automatic. If the primary model returns an error or times out, the agent retries with the fallback model before marking the step as failed.

### Execution Flow

The swarm graph is not a fixed linear pipeline. It branches based on what the agents discover:

```
Market Bias
    |
    +-- [Bullish/Bearish] --> Scanner --> Research --> Chart Vision --> Analyst --> Critic
    |                                                                              |
    +-- [Neutral] -------+                                                   [Approved?]
                         |                                                    /       \
                         |                                                 Yes         No
                         |                                                  |           |
                         |                                            Checkpoint    [Fixable?]
                         |                                                |          /      \
                         |                                           Publisher    Yes        No
                         |                                                      |           |
                         |                                               Analyst (retry)  Intel
                         |                                                                  |
                         +--------------------------------------------------------> Intel --> Generator --> Writer --> Checkpoint --> Publisher
```

If the market is neutral, the swarm skips signal generation entirely and produces a narrative intel report instead. If the critic rejects a thesis but marks it as fixable, the analyst gets one chance to revise. If the critic rejects definitively, the swarm falls back to the intel path.

### Quality Control

Signals do not get published unless they pass multiple gates:

- **Schema validation** on every agent output -- malformed responses are rejected immediately
- **Configurable quality thresholds** -- minimum confidence, minimum risk/reward ratio, minimum number of confluence factors
- **Adversarial critic review** -- the critic agent is specifically prompted to find weaknesses
- **Repair loop** -- one structured revision attempt when the thesis is close but flawed
- **Independent compute verification** -- an entirely separate model on 0G Compute reviews the thesis as a second opinion
- **Daily signal limit** -- prevents overproduction; when the limit is reached, the swarm produces intel reports only

---

## Architecture

### System Overview

```
                                +------------------+
                                |    Dashboard     |
                                |  (React + Vite)  |
                                +--------+---------+
                                         |
                                       REST API
                                         |
                                +--------+---------+
                                |     Backend      |
                                |    (Express)     |
                                +--------+---------+
                                         |
                      +------------------+------------------+
                      |                  |                  |
             +--------+-------+ +--------+-------+ +-------+--------+
             |  Agent Swarm   | |  Agent Network | |  Proof Layer   |
             |  (LangGraph)   | |  (Gensyn AXL)  | |  (0G Protocol) |
             |                | |                | |                |
             |  10 Agents +   | |  12 Peer Nodes | |  Storage +     |
             |  Orch + Memory | |                | |  Compute +     |
             |                | |                | |  Chain         |
             +--------+-------+ +--------+-------+ +-------+--------+
                      |                  |                  |
                      +------------------+------------------+
                                         |
                                +--------+---------+
                                |    PostgreSQL    |
                                |   (Supabase)     |
                                +------------------+
```

### Monorepo Layout

```
omen/
  backend/                 API server, pipeline orchestration, scheduler, publishers
  frontend/                Dashboard UI
  contracts/               Solidity contracts (iNFT, Verifier, Run Registry)
  packages/
    agents/                Agent definitions, prompts, state machine, graph
    axl/                   AXL adapter, A2A client, MCP services, topology
    zero-g/                0G Storage, Compute, Chain, iNFT, proofs
    db/                    Database client and repositories
    market-data/           Binance, CoinGecko, CMC, Birdeye, DeFiLlama
    indicators/            Technical indicators and chart analysis
    shared/                Shared types and schemas
    execution/             Execution engine interfaces
  scripts/                 AXL node launchers, contract compiler
  deploy/                  Fly.io node configuration
```

### Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 24, TypeScript 5.8 |
| Agent Framework | LangGraph.js (directed graph with conditional edges) |
| LLM Providers | Grok-4-fast / Grok-4.1, Gemini-3.1-flash-lite / GPT-5-nano, 0G Compute (adjudication) |
| Agent Network | Gensyn AXL (peer-to-peer encrypted communication) |
| Proof Storage | 0G Storage (KV, Log, File) |
| Proof Compute | 0G Compute (independent model verification) |
| Proof Anchoring | 0G Chain (on-chain manifest registry) |
| Database | Supabase PostgreSQL |
| Frontend | React 19, Vite 5, TailwindCSS, Recharts, Lightweight Charts |
| Backend | Express 5, Helmet, CORS |
| Image Generation | Hugging Face Inference |
| Social Publishing | TwitterAPI.io, Telegram Bot API |
| Trading | Hyperliquid SDK |
| Deployment | Vercel, Heroku, Fly.io |
| Contracts | Solidity 0.8.24 |

---

## Agent Network (AXL)

### Peer-to-Peer Agents

The AXL network runs twelve peer deployments on Fly.io: one orchestrator, ten agent role nodes including publisher, and one memory service node. Each has its own cryptographic identity:

| Component | Deployment | What It Runs |
|---|---|---|
| Orchestrator | `omen-axl-node` | Coordinates the swarm, delegates work to role nodes |
| Market Bias | `omen-axl-market-bias` | Macro bias assessment |
| Scanner | `omen-axl-scanner` | Asset scanning and candidate selection |
| Research | `omen-axl-research` | Multi-source data gathering |
| Chart Vision | `omen-axl-chart-vision` | Technical chart analysis |
| Analyst | `omen-axl-analyst` | Thesis generation |
| Critic | `omen-axl-critic` | Adversarial review |
| Intel | `omen-axl-intel` | Narrative intelligence synthesis |
| Generator | `omen-axl-generator` | Content formatting |
| Writer | `omen-axl-writer` | Long-form article drafting |
| Memory Service | `omen-axl-memory` | State persistence and historical recall tools |
| Publisher | `omen-axl-publisher` | Output routing and finalization |

Each node runs five processes: the AXL peer binary, an HTTP proxy, an MCP router for service discovery, an MCP service host exposing the agent's capabilities, and an A2A callback server for receiving delegated work.

### How Agents Communicate

The orchestrator delegates work to agents using the Agent-to-Agent (A2A) protocol:

1. The orchestrator reaches a step in the graph (e.g., "research")
2. It constructs a delegation request with the step input and the research node's peer ID
3. The request is encrypted and routed through the AXL mesh network
4. The research node receives the request, runs the research agent, and sends the result back
5. The orchestrator matches the response to the pending delegation and continues the graph

Agents can also call peer services directly. The writer node, for example, makes a peer-to-peer call to the memory service to retrieve historical context before drafting an article. This happens without the orchestrator's involvement.

Every message is recorded in the database with sender/receiver identities, delivery status, and optional links to 0G storage references.

### Service Discovery

Each agent registers its MCP tools with the local AXL router on startup. Other nodes can discover available services through the mesh network, enabling dynamic routing and service-level health checks.

### Network Health

The backend continuously polls the network topology through the `TopologyPoller`, tracking peer status, heartbeat timestamps, and service availability. The `PeerFailover` module routes around degraded nodes. Service registry snapshots are persisted for historical review.

You can inspect the latest persisted AXL evidence snapshot at `/api/topology`, or a run-specific snapshot with `/api/topology?runId=<run_id>`.

---

## Proof Infrastructure (0G)

Every swarm run generates a chain of evidence that anyone can inspect and verify. This is not a log file. It is a set of cryptographically anchored artifacts stored on decentralized infrastructure.

### Storage

Omen uses three types of 0G Storage:

**KV State** -- Real-time swarm state snapshots written at milestone steps. Each checkpoint captures a compact view of what every agent has produced so far. Stored on 0G's KV node infrastructure with namespaced keys.

**Log Entries** -- Immutable, append-only records written at each checkpoint. Creates a tamper-evident history of the run that cannot be retroactively modified.

**File Artifacts** -- Larger documents published as files: evidence bundles (all research data from a run), report bundles (the full signal or intel report), and manifests (the root document linking everything together).

### Compute Verification

After the local critic reviews a thesis, Omen optionally submits the thesis and evidence to a completely separate model running on 0G Compute infrastructure (Qwen 2.5 7B Instruct). This independent adjudicator returns its own verdict, confidence score, and rationale.

This is not the same model that produced the thesis. It is a second opinion from different infrastructure, and the result is recorded as a verifiable proof artifact.

### On-Chain Anchoring

After a run completes:

1. All proof artifacts are aggregated into a run manifest
2. The manifest is published to 0G Storage
3. The manifest's root hash (keccak256) is anchored on 0G Chain through the `OmenRunRegistry` contract
4. The transaction hash is recorded as a chain proof artifact

Anyone can look up a run ID on-chain and verify that the manifest stored at the URI matches the recorded hash.

### Proof Pipeline

Every run produces these proof layers:

| Layer | What It Contains | Where It Lives |
|---|---|---|
| Agent Events | Step-by-step execution trace | PostgreSQL |
| AXL Messages | Inter-agent communication records | PostgreSQL |
| Evidence Bundle | All research data and sources | 0G Storage |
| Report Bundle | Final signal or intel report | 0G Storage |
| State Checkpoints | Swarm state at milestone steps | 0G KV Store |
| Compute Proofs | Independent adjudication results | 0G Storage |
| Run Manifest | Root document linking all artifacts | 0G Storage |
| Chain Anchor | Manifest hash anchored on-chain | 0G Chain |
| iNFT Version | Encrypted swarm intelligence update for the completed run | 0G Storage + 0G Chain |
| Post Proofs | Social media post payload and delivery result | 0G Storage |

---

## Intelligent NFT (iNFT)

Omen has an ERC-7857-compatible intelligent NFT that represents the entire autonomous swarm as transferable on-chain property. The current Galileo deployment is `0xAA2c6434C776ae504AB96045Ce867D2E50b779F8`, token ID `1`.

The iNFT references encrypted intelligence stored on 0G Storage and keeps verifiable hashes on-chain. The encrypted bundle contains:
- The swarm role graph definition
- All agent prompt source files
- The 0G Compute model used for adjudication
- A memory root from a real completed swarm run

The intelligence bundle is encrypted with AES-256-GCM. The symmetric key is sealed with the owner's RSA-4096 public key. Only the private key holder can decrypt and inspect the referenced intelligence.

The mint script requires a real `OMEN_INFT_MEMORY_ROOT` from a completed 0G-backed run. It will not mint with placeholder data. After minting, the backend appends a new iNFT intelligence version after each completed run when `OMEN_INFT_CONTRACT_ADDRESS`, `OMEN_INFT_TOKEN_ID`, and the owner public key are configured.

When the iNFT is transferred, the `OmenAgentVerifier` contract validates re-encryption proofs to ensure the intelligence data is properly handed off to the new owner. Plain `transferFrom` is disabled; transfers must use `iTransfer`. Nonces prevent proof replay.

---

## Smart Contracts

Three contracts deployed on 0G Chain (Galileo testnet):

### OmenAgentINFT

Implements an ERC-7857-compatible iNFT surface. Supports minting with encrypted intelligence data, versioned per-run intelligence updates (`updateIntelligence`), verified transfers with re-encryption proofs (`iTransfer`), cloning (`iClone`), usage authorization for specific addresses, and access delegation. Each token stores encrypted URIs pointing to 0G Storage and verifiable data hashes.

### OmenAgentVerifier

Validates transfer proofs for the iNFT contract. Recovers signer addresses from EIP-191 signed access and ownership proofs, enforces nonce uniqueness to prevent replay, and maintains a trust registry of attestor addresses. Supports both TEE and ZKP oracle types.

### OmenRunRegistry

On-chain registry for swarm run manifests. Stores the run ID, manifest root hash, manifest URI, anchorer address, timestamp, and block number. Emits indexed `RunAnchored` events for efficient querying.

---

## Dashboard

The web dashboard at `omen-agents.vercel.app` provides real-time visibility into everything the swarm does.

**Home** -- System status, latest signal, latest intel report, and a live terminal log of agent activity. Refreshes every 30 seconds.

**Signals** -- Feed of all trading signals with confidence scores, direction, entry/target/stop prices, risk/reward, PnL tracking, and proof badges linking to the underlying evidence.

**Intel** -- Feed of narrative intelligence reports with category badges, confidence scores, AI-generated cover images, and full article views with rich markdown content.

**Copytrade** -- Automated copy-trading interface for Hyperliquid. Enroll a wallet, configure risk settings, and the system executes trades based on approved signals.

**Analytics** -- Multi-tab analytics suite:
- Overview: signal count, win rate, activity over time
- Performance: PnL tracking, per-asset metrics, confidence-outcome correlation
- Market: token frequency analysis, mindshare distribution
- Signals: confidence distribution, direction breakdown, status tracking

**Evidence** -- Proof visualization for each run. Manifest panels, chain anchor cards, compute proof cards, iNFT references, run-specific AXL topology/route snapshots, and clickable 0G Storage links.

**Traces** -- AXL communication trace viewer. Step-by-step execution timeline, peer topology, service registry state, and message-level inspection.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/status` | Runtime status and scheduler state |
| GET | `/api/runs` | Swarm run history |
| GET | `/api/dashboard/summary` | Latest signal, intel, and post IDs |
| GET | `/api/dashboard/scheduler` | Scheduler status |
| GET | `/api/signals` | Signal feed (paginated) |
| GET | `/api/signals/:id` | Signal detail |
| GET | `/api/signals/:id/chart` | Chart data for signal visualization |
| GET | `/api/signals/:id/candles` | OHLCV candle data |
| GET | `/api/intel` | Intel feed (paginated) |
| GET | `/api/intel/:id` | Intel detail |
| GET | `/api/analytics` | Analytics snapshots |
| GET | `/api/analytics/latest` | Latest analytics |
| GET | `/api/topology` | Latest persisted AXL evidence snapshot; accepts `runId` for run-specific topology, services, and routes |
| GET | `/api/proofs` | Proof artifact feed |
| GET | `/api/proofs/:runId` | Proofs for a specific run |
| GET | `/api/posts` | Outbound post feed |
| GET | `/api/logs` | Agent event log |
| GET | `/api/inft` | iNFT metadata |
| GET | `/api/copytrade/account` | Copytrade account info |
| GET | `/api/copytrade/status` | Enrollment status |
| GET | `/api/copytrade/dashboard` | Positions, trades, PnL |
| POST | `/api/copytrade/prepare` | Start enrollment |
| POST | `/api/copytrade/finalize` | Complete enrollment with signature |
| PATCH | `/api/copytrade/risk-settings` | Update risk parameters |

---

## Copytrade

Omen includes automated copy-trading on Hyperliquid.

**How it works:**

1. You prepare an enrollment with your wallet address and risk settings
2. Omen generates a dedicated agent wallet and encrypts the private key (AES-256) before storing it
3. You sign an approval nonce to authorize the agent wallet
4. When the swarm approves a signal, the system opens a position on Hyperliquid with your configured leverage and size
5. Take-profit and stop-loss orders are set automatically
6. Positions are monitored and closed when targets are hit

Risk settings are fully configurable: position size (USD), leverage, take-profit percentage, stop-loss percentage, and maximum concurrent positions.

The system runs on real Hyperliquid infrastructure and supports both **mainnet** and **testnet** environments. While there is no paper trading mode built into the app, you can use Hyperliquid testnet for safe simulation.

---

## Data Sources

The swarm pulls live data from five providers:

| Provider | Data | Used By |
|---|---|---|
| **Binance** | OHLCV candles, 24h tickers, order book, trades | Research, Chart Vision |
| **CoinGecko** | Market cap, price changes, volume, supply, dominance | Research |
| **CoinMarketCap** | Market cap rankings, supply, platform metadata | Research |
| **Birdeye** | On-chain analytics, holder distribution, liquidity, security | Research |
| **DeFiLlama** | Protocol TVL, TVL changes, chain distribution | Research |

All data clients support API key rotation (multiple keys per provider), request timeouts, and graceful degradation when a provider is down. Hugging Face image-generation token rotation persists its cursor in `hf_token_rotation_state`.

Technical indicators (SMA, EMA, RSI, MACD, Bollinger Bands) are computed locally from Binance candle data.

---

## Database

PostgreSQL on Supabase. Core tables:

| Table | What It Stores |
|---|---|
| `runs` | Swarm run records: status, mode, bias, outcome, timing |
| `signals` | Trading signals: thesis fields, prices, PnL |
| `intels` | Intelligence reports: title, body, category, confidence, image |
| `agent_nodes` | Node registry: role, transport, status, peer ID |
| `agent_events` | Execution events with trace payloads |
| `axl_messages` | AXL communication records |
| `zero_g_refs` | Proof artifact references (storage, compute, chain) |
| `outbound_posts` | Social media post queue and status |
| `analytics_snapshots` | Pre-computed analytics data |
| `copytrade_enrollments` | User enrollments with encrypted agent keys |
| `copytrade_trades` | Trade positions and PnL records |
| `service_registry_snapshots` | AXL service registry captures |
| `hf_token_rotation_state` | Hugging Face token rotation cursor state |
| `app_config` | Runtime configuration |

---

## Publishing

### X/Twitter

Signals and intel reports are published to X/Twitter through TwitterAPI.io. The post worker manages a state machine: `queued -> formatting -> ready -> posting -> posted/failed`. Rate limiting prevents API abuse.

Post formats:
- **Signal alerts** with direction, confidence, prices, and risk/reward
- **Intel summaries** with title and key insight

### Telegram

The Telegram bot sends signal and intel notifications to the configured channel with deep links back to the dashboard.

### Post Proofs

Every published post generates two proof artifacts -- the formatted payload before delivery and the delivery result (post ID, published URL). These are included in the run manifest so anyone can verify that a specific post came from a specific swarm run.

---

## Deployment

### Frontend (Vercel)

```bash
# Root: frontend/
# Build: cd .. && pnpm --filter omen-frontend build
# Output: dist
# Set VITE_API_BASE_URL to your backend URL
```

### Backend (Heroku)

```bash
heroku create omen-backend
heroku buildpacks:set heroku/nodejs
heroku config:set NODE_ENV=production SCHEDULER_ENABLED=true
# Set all env vars from backend/.env.example
git push heroku main
```

Runs as a single web dyno with an in-process scheduler. TypeScript executed at runtime through tsx.

### Agent Nodes (Fly.io)

Each role is a separate Fly.io app:

```bash
fly apps create omen-axl-<role>
fly volumes create axl_data --size 1 --region sin --app omen-axl-<role>
fly secrets set AXL_PRIVATE_KEY_B64=<key> --app omen-axl-<role>
fly deploy -c deploy/fly/axl.fly.toml --app omen-axl-<role>
```

### Contracts

```bash
pnpm contracts:compile           # Compile Solidity
pnpm inft:deploy                 # Deploy Verifier + iNFT contracts
pnpm inft:mint                   # Mint the swarm iNFT
pnpm --filter @omen/zero-g deploy:run-registry   # Deploy RunRegistry
```

---

## Local Development

### Prerequisites

- Node.js 24
- pnpm 10

### Setup

```bash
git clone https://github.com/zaikaman/Omen.git
cd Omen
pnpm install
```

### Run

```bash
pnpm dev                # Frontend + backend in parallel
pnpm frontend           # Vite dev server (port 5173)
pnpm backend            # Express server (port 4001)
```

### Local Agent Network

```bash
pnpm axl:start:demo          # Start all 12 nodes locally
pnpm axl:start:demo:core     # Core nodes only
pnpm axl:stop:demo           # Stop all nodes
pnpm axl:verify:a2a          # Verify A2A communication works
```

### Database

```bash
pnpm supabase:start          # Start local Supabase
pnpm supabase:reset          # Reset and reseed
```

### Quality

```bash
pnpm test                    # All tests
pnpm lint                    # ESLint
pnpm typecheck               # TypeScript checking
```

---

## Configuration

All configuration is through environment variables. See `backend/.env.example` for the full reference.

Key groups:

| Group | Purpose |
|---|---|
| `SUPABASE_*` | Database connection |
| `OPENAI_*` | Primary LLM |
| `SCANNER_*` | Scanner-specific LLM (Grok-4.1) |
| `AXL_*` | Peer network (agent nodes, orchestrator, publisher, and memory service IDs) |
| `ZERO_G_*` | 0G Storage, Compute, and Chain |
| `OMEN_INFT_*` | iNFT contract, mint, and automatic intelligence versioning |
| `COINGECKO_API_KEY`, `BIRDEYE_API_KEY`, `CMC_API_KEY` | Market data |
| `TWITTERAPI_*` | X/Twitter posting |
| `TELEGRAM_*` | Telegram notifications |
| `FUTURES_ENCRYPTION_KEY` | Copytrade agent key encryption |
| `HF_TOKEN_*` | Hugging Face image generation |
| `R2_*` | Cloudflare R2 for image storage |

---

## Security

**Agent key encryption** -- Copytrade wallet keys are encrypted with AES-256 before database storage.

**iNFT encryption** -- Intelligence bundles use AES-256-GCM with RSA-4096 key sealing. Only the owner's private key can decrypt.

**AXL encryption** -- All peer-to-peer agent communication is end-to-end encrypted by the AXL node binary.

**API security** -- CORS enforcement, Helmet headers, Zod schema validation on all inputs.

**Contract security** -- Nonce replay protection on transfer proofs. Trusted attestor registry. Owner-gated admin functions.

---

## AI Tool Attribution

This project was built with significant assistance from AI coding tools, as permitted by the hackathon guidelines. This section documents where and how AI tools were used across the codebase.

### Tool

OpenAI Codex with GPT-5.5, used as a continuous pair-programming partner throughout the project.

### How It Was Used

The AI assistant operated as an interactive coding partner, not as a batch code generator. The typical workflow was: the team described what needed to be built (often through specification documents), the AI proposed an implementation, the team reviewed and tested it, and then iterated through corrections and refinements. Every piece of AI-generated code was reviewed by the team before being committed.

### What the Team Owned

All product direction, architecture decisions, system design, agent role definitions, quality thresholds, prompt engineering strategy, deployment topology, and the decision of which sponsor technologies (AXL, 0G) to integrate and how deeply. 

### Specific AI-Assisted Areas

**Backend pipeline** (`backend/src/pipelines/live-swarm-pipeline.ts`) -- The ~3,000-line pipeline orchestrating the full swarm run was built collaboratively. The team specified the step ordering, checkpoint strategy, and publishing sequence. The AI assisted with the implementation of each step handler, AXL delegation wiring, 0G storage calls, and error handling patterns.

**Agent definitions** (`packages/agents/src/definitions/*.ts`) -- Each agent's prompt template, input/output Zod schema, and LLM configuration was developed with AI assistance. The team defined the role responsibilities, quality criteria, and data flow contracts. The AI helped translate those into working TypeScript definitions and schema declarations.

**Swarm graph** (`packages/agents/src/framework/omen-swarm-graph.ts`) -- The LangGraph-based execution graph with conditional branching logic was co-developed. The team designed the graph topology and branching rules (neutral market skips scanner, repairable rejections loop back). The AI implemented the `resolveNextOmenNodeKey`, `buildOmenNodeInput`, and `applyOmenNodeOutput` functions.

**AXL integration** (`packages/axl/src/**/*.ts`) -- The A2A client, HTTP adapter, MCP service contracts, and topology modules were built with AI assistance. The team studied the AXL documentation, designed the delegation protocol, and specified the peer topology. The AI implemented the adapter code, message serialization, and service registry sync.

**0G integration** (`packages/zero-g/src/**/*.ts`) -- The storage adapters (KV, Log, File), compute adjudication module, chain adapter, proof anchor, iNFT encryption, and manifest builder were built with AI assistance. The team designed the proof pipeline architecture and chose which 0G services to use. The AI implemented the SDK integration code.

**Smart contracts** (`contracts/*.sol`) -- `OmenAgentINFT.sol`, `OmenAgentVerifier.sol`, and `OmenRunRegistry.sol` were developed with AI assistance. The team specified the ERC-7857 requirements, the proof verification logic, and the on-chain anchoring pattern. The AI drafted the Solidity implementations, which were reviewed for correctness and security.

**Frontend components** (`frontend/src/**/*.tsx`) -- Dashboard pages, signal/intel cards, chart integrations, analytics visualizations, proof badge system, and copytrade UI were built with AI assistance. The team designed the UI layout and interaction patterns. The AI implemented the React components, hook logic, and API integration.

**MCP service hosts** (`backend/src/nodes/services/*-mcp.ts`) -- The eleven MCP tool definitions for AXL service discovery were built with AI assistance based on the agent definition contracts.

**Database repositories** (`packages/db/src/repositories/*.ts`) -- Supabase query builders for all tables were AI-assisted.

**Market data clients** (`packages/market-data/src/**/*.ts`) -- Binance, CoinGecko, CMC, Birdeye, and DeFiLlama API clients were built with AI assistance. The team selected the providers, specified the data requirements, and designed the key rotation scheme.

**Publishing pipeline** (`backend/src/publishers/*.ts`) -- All thirteen publishers in the post-run finalization sequence were AI-assisted.

**Scheduler** (`backend/src/scheduler/*.ts`) -- The hourly scheduler with persistence, overlap protection, and failure handling was AI-assisted.

**Post formatter and worker** (`backend/src/services/x/*.ts`) -- The Twitter post formatting, state machine, and rate limiting were AI-assisted.

**Copytrade system** (`backend/src/services/copytrade/*.ts`) -- The enrollment flow, signal monitoring, and Hyperliquid trade execution were AI-assisted.

**Deployment scripts** (`scripts/axl/*.ps1`, `deploy/**`) -- AXL node launcher scripts and Fly.io deployment configs were AI-assisted.

**Documentation** -- This `README.md`, `DEPLOYMENT.md`, `AXL_DEMO.md`, and `INFT_DEPLOYMENT.md` were drafted with AI assistance from the team's specifications and notes.

### Assets Not Generated by AI

- **AXL node binary** -- Provided by Gensyn (third-party dependency)
- **0G TypeScript SDK** -- Provided by 0G Labs (third-party dependency)
- **LangGraph.js framework** -- Vendored open-source dependency
- **Agent prompt content and strategy** -- Directed by the team; the AI helped with syntax and structure but the analytical methodology, quality thresholds, and risk management philosophy were team decisions

---

## Deep Dive: Swarm State

The swarm maintains a single state object that grows as agents execute. Each agent receives a read-only snapshot of the current state and returns a delta. The delta is merged into the state before the next agent runs. No agent can modify another agent's output retroactively.

Key fields:

```
run                        Run ID, mode, status, market bias, outcome, timing
config                     Runtime settings, market universe, quality thresholds, provider flags
marketBiasReasoning        The bias agent's full reasoning text
activeCandidates[]         Scanner's selected candidates with direction hints and status
evidenceItems[]            Research evidence: category, summary, source, structured data
chartVisionSummaries[]     Chart vision's consolidated technical summaries
thesisDrafts[]             Analyst's structured theses with all trade parameters
criticReviews[]            Critic decisions with objections and repair instructions
intelReports[]             Intel agent's narrative reports with confidence and category
generatedIntelContents[]   Generator's publishable content formats
intelArticles[]            Writer's long-form articles
publisherDrafts[]          Publisher's formatted social media drafts
proofArtifacts[]           Accumulated proof references from all steps
notes[]                    Execution trace notes (human-readable breadcrumbs)
errors[]                   Error messages from any step
signalRepairAttempts       Counter for the analyst-critic repair loop
latestCheckpointRefId      Reference to the most recent 0G checkpoint
activeTradeSymbols[]       Currently open copytrade symbols (for dedup)
recentIntelHistory[]       Recent intel reports (for topic dedup)
signalGenerationDisabledReason   Set when daily signal limit is reached
```

The state design ensures full traceability. After a run completes, you can inspect exactly what each agent received and produced by walking the checkpoint chain.

---

## Deep Dive: Scheduler

The `HourlyScheduler` manages autonomous execution:

- **Interval**: Configurable, defaults to 60 minutes
- **Persistence**: Loads the last run timestamp from the database to survive process restarts. If the last run was 45 minutes ago and the interval is 60 minutes, the next run schedules in 15 minutes, not 60.
- **Overlap protection**: Uses a `RunLock` to prevent concurrent swarm runs. If a tick fires while a run is still active, it logs a warning and skips.
- **Failure handling**: On task failure, the scheduler optionally pauses itself and sends a notification through Telegram. The `DefaultRunCoordinator` wraps the pipeline with retry logic -- if a run fails, it deletes the partial database records and retries with a fresh run ID.
- **Graceful startup**: On first boot with no run history, the scheduler fires within 5 seconds rather than waiting the full interval.

The scheduler produces structured `SchedulerTaskContext` objects containing the run ID, trigger type, triggered timestamp, and runtime mode flags that control which external APIs the swarm is allowed to call.

---

## Deep Dive: Publishing Pipeline

After the swarm graph completes, the pipeline runs the finalization publishers in sequence:

| Order | Publisher | What It Does |
|---|---|---|
| 1 | `EventPublisher` | Persists agent events to `agent_events` |
| 2 | `AxlMessageRecorder` | Records AXL envelopes to `axl_messages` |
| 3 | `ZeroGRefRecorder` | Records 0G references to `zero_g_refs` |
| 4 | `ZeroGPublisher` | Uploads artifacts to 0G Storage |
| 5 | `EvidenceBundlePublisher` | Bundles and uploads all research evidence |
| 6 | `ReportBundlePublisher` | Bundles and uploads the signal or intel report |
| 7 | `ComputeProofRecorder` | Records 0G Compute adjudication artifacts |
| 8 | `RunManifestPublisher` | Builds the run manifest and uploads it to 0G Storage |
| 9 | `ZeroGProofAnchor` | Anchors the manifest root on 0G Chain |
| 10 | `OmenAgentInftPublisher` | Uploads encrypted run intelligence and appends an iNFT version |
| 11 | `PostPublisher` | Formats and posts to X/Twitter |
| 12 | `PostProofPublisher` | Records post payload and delivery result as proofs |
| 13 | `PostResultRecorder` | Updates the post record with final delivery status |

Each publisher is isolated. If the Twitter post fails, the proof anchoring still completes. If 0G Storage is temporarily unavailable, the run still finishes and the database records are preserved.

---

## Deep Dive: MCP Services

Each agent node and service node exposes capabilities as MCP (Model Context Protocol) tools. These are the actual service definitions that other nodes in the mesh can discover and call:

| Node | MCP Tool | Purpose |
|---|---|---|
| Market Bias | `market_bias.generate` | Macro bias assessment |
| Scanner | `scan.candidates` | Asset scanning |
| Research | `research.investigate` | Multi-source research |
| Chart Vision | `chart_vision.analyze` | Technical chart analysis |
| Analyst | `analyst.synthesize` | Thesis generation |
| Critic | `critic.review` | Adversarial evaluation |
| Intel | `intel.synthesize` | Narrative intelligence |
| Generator | `generator.produce` | Content generation |
| Writer | `writer.article` | Long-form drafting |
| Memory Service | `memory.recall`, `memory.store` | Historical context and state persistence |
| Publisher | `publisher.finalize` | Output routing |

The writer's call to `memory.recall` is the clearest example of peer-to-peer service communication -- it reaches the memory service by peer ID, retrieves historical context, and incorporates it into the article, all without the orchestrator knowing or mediating.

---

## Deep Dive: Agent Thesis Format

When the analyst produces a trading thesis, it follows this exact structure:

```
candidateId       ID of the scanned candidate
asset             Token symbol (e.g., $BTC)
direction         LONG | SHORT | WATCHLIST | NONE
confidence        0-100 integer
orderType         market | limit
tradingStyle      day_trade | swing_trade
expectedDuration  Human-readable time estimate
currentPrice      Current market price
entryPrice        Recommended entry price
targetPrice       Primary target price
stopLoss          Stop-loss level
riskReward        Calculated risk/reward ratio
whyNow            One paragraph: why this trade, why right now
confluences       List of supporting factors
uncertaintyNotes  What the analyst is unsure about
missingDataNotes  What data was unavailable
```

The critic evaluates this entire structure against the evidence base and the configured quality thresholds. A thesis with a confidence of 55 when the minimum is 60 gets rejected. A thesis with one confluence when the minimum is two gets rejected. The critic also checks for internal inconsistencies -- a LONG thesis with an entry price above the target price, for example.

---

## Deep Dive: Intel Reports

When the swarm produces narrative intelligence (either because the market is neutral or a signal was rejected), the intel agent generates a structured report:

```
topic             Subject matter
title             Report headline
summary           One-paragraph summary
insight           Key analytical insight
category          market_update | narrative_shift | token_watch | macro | opportunity
confidence        0-100 integer
importanceScore   0-100 integer
symbols           Associated token symbols
imagePrompt       Prompt for generating the cover image
```

The generator transforms this into publishable content. The writer produces a long-form article. The publisher routes the final output to social platforms.

Intel reports are deduped against recent history. The intel agent receives the last several reports and post texts to avoid producing repetitive content.

Cover images are generated through Hugging Face Inference using carefully constructed prompts that avoid any text, ticker symbols, logos, or brand marks in the generated image.

---

## Deep Dive: Evidence Categories

The research agent produces structured evidence items across eight categories:

| Category | What It Captures |
|---|---|
| `market` | Price action, volume, market cap changes, 24h performance |
| `technical` | Indicator readings (RSI, MACD, moving averages), pattern recognition |
| `liquidity` | Order book depth, bid/ask spreads, exchange flow data |
| `funding` | Funding rates, open interest, leverage metrics |
| `fundamental` | TVL, protocol revenue, tokenomics, supply metrics |
| `catalyst` | Upcoming events, partnerships, protocol upgrades, narratives |
| `sentiment` | Social volume, fear/greed indicators, influencer attention |
| `chart` | Multi-timeframe chart vision analysis summaries |

Each evidence item includes a source label (e.g., "CoinGecko"), a source URL for verification, a human-readable summary, and an optional `structuredData` payload with the raw metrics.

The analyst and critic both receive the full evidence array, ensuring the critic can verify whether the thesis is actually supported by the evidence rather than hallucinated.

---

## File-Level Integration Reference

### 0G Protocol Files

| Component | File |
|---|---|
| KV State Store | `packages/zero-g/src/storage/zero-g-state-store.ts` |
| Log Store | `packages/zero-g/src/storage/zero-g-log-store.ts` |
| File Store | `packages/zero-g/src/storage/zero-g-file-store.ts` |
| Storage Adapter | `packages/zero-g/src/storage/storage-adapter.ts` |
| Compute Adapter | `packages/zero-g/src/compute/compute-adapter.ts` |
| Adjudication | `packages/zero-g/src/compute/zero-g-adjudication.ts` |
| Report Synthesis | `packages/zero-g/src/compute/zero-g-report-synthesis.ts` |
| Chain Adapter | `packages/zero-g/src/chain/chain-adapter.ts` |
| Proof Anchor | `packages/zero-g/src/chain/proof-anchor.ts` |
| Run Registry | `packages/zero-g/src/chain/omen-run-registry.ts` |
| iNFT Client | `packages/zero-g/src/chain/omen-agent-inft.ts` |
| Verifier Client | `packages/zero-g/src/chain/omen-agent-verifier.ts` |
| Encryption | `packages/zero-g/src/inft/encryption.ts` |
| Intelligence Bundle | `packages/zero-g/src/inft/omen-agent-intelligence.ts` |
| Proof Registry | `packages/zero-g/src/proofs/proof-registry.ts` |
| Manifest Builder | `packages/zero-g/src/proofs/run-manifest-builder.ts` |

### AXL Protocol Files

| Component | File |
|---|---|
| A2A Client | `packages/axl/src/a2a/a2a-client.ts` |
| Delegation Contract | `packages/axl/src/a2a/delegation-contract.ts` |
| AXL Adapter | `packages/axl/src/adapter/axl-adapter.ts` |
| HTTP Adapter | `packages/axl/src/adapter/axl-http-adapter.ts` |
| MCP Service Contract | `packages/axl/src/mcp/service-contract.ts` |
| MCP Service Registry | `packages/axl/src/mcp/service-registry.ts` |
| HTTP Node Client | `packages/axl/src/node-client/http-node-client.ts` |
| Orchestrator Delegator | `backend/src/nodes/a2a/orchestrator-delegator.ts` |
| Response Correlator | `backend/src/nodes/a2a/response-correlator.ts` |
| Topology Poller | `backend/src/nodes/topology/topology-poller.ts` |
| Service Registry Sync | `backend/src/nodes/topology/service-registry-sync.ts` |
| Peer Failover | `backend/src/nodes/topology/peer-failover.ts` |

### Agent Definitions

| Component | Definition | MCP Service |
|---|---|---|
| Market Bias | `packages/agents/src/definitions/market-bias.ts` | `backend/src/nodes/services/market-bias-mcp.ts` |
| Scanner | `packages/agents/src/definitions/scanner.ts` | `backend/src/nodes/services/scanner-mcp.ts` |
| Research | `packages/agents/src/definitions/research.ts` | `backend/src/nodes/services/research-mcp.ts` |
| Chart Vision | `packages/agents/src/definitions/chart-vision.ts` | `backend/src/nodes/services/chart-vision-mcp.ts` |
| Analyst | `packages/agents/src/definitions/analyst.ts` | `backend/src/nodes/services/analyst-mcp.ts` |
| Critic | `packages/agents/src/definitions/critic.ts` | `backend/src/nodes/services/critic-mcp.ts` |
| Intel | `packages/agents/src/definitions/intel.ts` | `backend/src/nodes/services/intel-mcp.ts` |
| Generator | `packages/agents/src/definitions/generator.ts` | `backend/src/nodes/services/generator-mcp.ts` |
| Writer | `packages/agents/src/definitions/writer.ts` | `backend/src/nodes/services/writer-mcp.ts` |
| Memory Service | `packages/agents/src/definitions/memory.ts` | `backend/src/nodes/services/memory-mcp.ts` |
| Publisher | `packages/agents/src/definitions/publisher.ts` | `backend/src/nodes/services/publisher-mcp.ts` |

---

## Deep Dive: Runtime Modes

The swarm supports multiple runtime modes that control what external resources it can access:

| Mode | External Reads | External Writes | Description |
|---|---|---|---|
| `live` | Yes | Yes | Full production mode: reads market data, posts to X/Twitter |
| `live_readonly` | Yes | No | Reads real market data but does not post to social platforms |
| `dry_run` | No | No | Runs the full pipeline with cached/local data only |

Runtime mode is set through the `RUNTIME_MODE` environment variable and propagated through every scheduler context. Each agent receives the mode flags and can adjust its behavior accordingly. Data providers check the `allowsExternalReads` flag before making API calls. The post publisher checks `allowsExternalWrites` before queuing social media posts.

This allows you to test the full swarm pipeline locally without accidentally posting to production social accounts or consuming API rate limits.

---

## Deep Dive: Image Generation

Each intel report gets an AI-generated cover image. The pipeline:

1. The generator agent produces an `imagePrompt` describing the scene
2. The prompt is sanitized: all ticker symbols (`$BTC`, `$ETH`) are replaced with "an unmarked digital asset"
3. A strict negative prompt is appended: "no words, no letters, no numbers, no captions, no labels, no logos, no brand marks, no watermarks, no signatures, no ticker symbols, no charts with axes or legends"
4. The image is generated through Hugging Face Inference
5. The resulting image is uploaded to Cloudflare R2
6. The R2 URL is stored with the intel record

The system uses up to 17 Hugging Face API tokens with rotation to handle rate limits across multiple concurrent image generation requests.

Image prompts are carefully constructed to produce cinematic, abstract market illustrations that capture the thesis without any text or identifiable symbols. This prevents issues with AI-generated text artifacts in images.

---

## Deep Dive: Analytics

The analytics system pre-computes dashboard metrics through the `AnalyticsSnapshotsRepository`:

**Activity tracking** -- Counts of signals and intel reports produced per time period, broken down by category and outcome.

**Win rate** -- Calculated from signals that have been resolved (hit target or hit stop). The win rate chart shows the rolling win rate over time.

**PnL tracking** -- Cumulative profit and loss from resolved signals, calculated from the entry price, exit price, and direction.

**Confidence-outcome correlation** -- Maps confidence scores to actual outcomes to measure calibration. A well-calibrated system should see higher win rates at higher confidence levels.

**Token frequency** -- Tracks which tokens the swarm analyzes most frequently, indicating market attention and narrative focus.

**Mindshare** -- Distribution of intel report topics and categories, showing what narratives the swarm is tracking.

**Per-asset performance** -- Win rate, average PnL, and signal count broken down by individual tokens.

Analytics snapshots are computed periodically and stored in the `analytics_snapshots` table. The frontend reads these pre-computed snapshots rather than computing metrics on every page load.

---

## Deep Dive: Copytrade Internals

The copytrade system has three main components:

**CopytradeEnrollmentService** -- Manages the enrollment lifecycle:
1. `prepare` -- Generates an agent wallet (Ethereum keypair), encrypts the private key with AES-256 using the server's `FUTURES_ENCRYPTION_KEY`, and stores the enrollment record
2. `finalize` -- Verifies the user's signature, decrypts the agent key, and submits the agent wallet approval to Hyperliquid's L1

**SignalMonitorService** -- Polls the signals table every 20 seconds (configurable via `COPYTRADE_EXECUTOR_INTERVAL_MS`). When a new approved signal appears:
1. Checks all active enrollments
2. Filters out enrollments that already have a position in the signal's asset
3. Filters out enrollments at their maximum concurrent position limit
4. Queues trade execution for eligible enrollments

**HyperliquidTradeExecutor** -- Executes trades on Hyperliquid:
1. Calculates position size from the enrollment's USD allocation and the asset's current price
2. Places a market or limit order with the configured leverage
3. Attaches take-profit and stop-loss trigger orders
4. Records the trade in `copytrade_trades` with the signal reference
5. Monitors for position closure and records final PnL

The executor handles Hyperliquid's order format requirements, including L1 signature generation, price tick rounding, minimum size constraints, and routing to either the mainnet or testnet API based on the application configuration.

---

## Deep Dive: Signal Lifecycle

A trading signal goes through multiple states from creation to resolution:

```
swarm produces thesis
         |
    critic reviews
         |
    [approved] --> signal created (status: pending)
                          |
                   published to X/Twitter and Telegram
                          |
                   copytrade opens positions
                          |
                   price monitoring begins
                          |
              +-----------+-----------+
              |           |           |
         hit target   hit stop   signal expires
              |           |           |
        status: won  status: lost  status: expired
              |           |           |
         PnL recorded  PnL recorded  marked inactive
```

When a signal is created, it includes:

- **Entry zone** with low and high bounds
- **Target prices** (up to three, ordered by distance)
- **Stop loss** as an invalidation zone
- **Risk/reward ratio** calculated from entry, primary target, and stop
- **Confidence score** from the analyst, validated by the critic
- **Expected duration** (e.g., "2-5 days")
- **Order type** (market for immediate entry, limit for pullback entry)

The dashboard tracks signals in real-time, showing current price relative to entry/target/stop, cumulative PnL, and status badges. The analytics suite uses resolved signals to compute win rate, average PnL, and calibration metrics.

Proof badges on each signal card link to the underlying evidence: the AXL communication trace, the 0G manifest, the compute adjudication result, and the chain anchor transaction. Anyone can follow the chain from a published tweet back to the specific research evidence that produced it.

---

## Deep Dive: Error Handling and Resilience

The system is designed to degrade gracefully rather than fail catastrophically:

**Agent failures** -- If any agent step throws an error, the pipeline records the error in the swarm state, marks the run as failed, and triggers the run coordinator's retry logic. Failed runs are cleaned from the database before retry to prevent partial data.

**Data provider failures** -- All market data clients implement graceful degradation. If CoinGecko is down, the research agent proceeds with data from the remaining providers. The agent explicitly notes missing data sources in its output so the analyst and critic can account for information gaps.

**AXL network failures** -- If a peer node is unresponsive, the `PeerFailover` module routes around it. The orchestrator delegator implements configurable timeouts (default: 5 minutes). Failed A2A delegations fall back to local execution when possible.

**0G Storage failures** -- If 0G Storage is temporarily unavailable, the pipeline still completes. Database records are always written. Storage artifacts are best-effort -- their absence is recorded but does not block the run.

**Post delivery failures** -- Social media posting failures do not affect the signal or proof pipeline. The post worker retries delivery and records the final status regardless of outcome.

**Scheduler resilience** -- The scheduler survives process restarts by persisting the last run timestamp. It calculates the next run time relative to the persisted timestamp, not the current time, preventing schedule drift after deployments.

---

## Verification

If you want to verify that the system is real and not a scripted demo:

### Check the live agent network

```bash
# Each of these returns a different peer ID -- proof of separate processes
curl https://omen-axl-node.fly.dev/topology
curl https://omen-axl-writer.fly.dev/topology
curl https://omen-axl-scanner.fly.dev/topology
```

You should see 12 distinct peer IDs: the orchestrator, ten agent role nodes including publisher, and the memory service node.

### Run the A2A verification suite

```bash
# Sends real delegation requests to the agent role nodes and validates responses
pnpm axl:verify:a2a

# Or test just the critical path
pnpm axl:verify:a2a --profile core
```

This sends actual work to each agent node through the AXL mesh and validates that every response matches the production output schema. The writer response includes peer context from the memory service, proving direct peer-to-peer service communication.

### Inspect on-chain proofs

Open the `OmenRunRegistry` address directly on 0G Chain Scan: [0x6DAEE6bb260D6a31e73Ff87DB8e0f41c4dc9186D](https://chainscan-galileo.0g.ai/address/0x6DAEE6bb260D6a31e73Ff87DB8e0f41c4dc9186D). Do not search for the contract name; the explorer only resolves hex addresses and transaction hashes. The dashboard proof cards also link directly to the chain anchor transaction for each completed run.

### Inspect the iNFT

The current `OmenAgentINFT` is `0xAA2c6434C776ae504AB96045Ce867D2E50b779F8`, token ID `1`. You can verify the token exists, inspect its intelligent data hashes and version records, and confirm the encrypted storage URI points to real content on 0G Storage.

### View live output

The dashboard at [omen-agents.vercel.app](https://omen-agents.vercel.app) shows live signals, intel reports, and proof badges. The evidence page links directly to 0G Storage artifacts and on-chain transactions.

---

## License

Built for the Open Agents Hackathon by ETHGlobal.
