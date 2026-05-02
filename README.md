# Omen

**Autonomous Market-Intelligence Swarm with Decentralized Agent Communication and On-Chain Proof Infrastructure**

Built for the [Open Agents Hackathon](https://ethglobal.com/) by ETHGlobal.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Problem Statement](#problem-statement)
- [Architecture](#architecture)
  - [System Design](#system-design)
  - [Monorepo Structure](#monorepo-structure)
  - [Technology Stack](#technology-stack)
- [Agent Swarm](#agent-swarm)
  - [Swarm Roles](#swarm-roles)
  - [Swarm Execution Graph](#swarm-execution-graph)
  - [Quality Gates and Repair Loops](#quality-gates-and-repair-loops)
- [AXL Integration (Gensyn)](#axl-integration-gensyn)
  - [Deployed AXL Network](#deployed-axl-network)
  - [A2A Delegation Protocol](#a2a-delegation-protocol)
  - [MCP Service Layer](#mcp-service-layer)
  - [Writer-to-Memory Peer Communication](#writer-to-memory-peer-communication)
  - [Topology and Service Registry](#topology-and-service-registry)
  - [Verification](#verification)
- [0G Integration](#0g-integration)
  - [0G Storage](#0g-storage)
  - [0G Compute](#0g-compute)
  - [0G Chain](#0g-chain)
  - [iNFT (ERC-7857)](#inft-erc-7857)
  - [Run Manifest and Proof Pipeline](#run-manifest-and-proof-pipeline)
- [Smart Contracts](#smart-contracts)
  - [OmenAgentINFT](#omenagentinft)
  - [OmenAgentVerifier](#omenagentverifier)
  - [OmenRunRegistry](#omenrunregistry)
- [Frontend Dashboard](#frontend-dashboard)
  - [Pages and Features](#pages-and-features)
  - [Evidence and Proof Visualization](#evidence-and-proof-visualization)
  - [Analytics Suite](#analytics-suite)
- [Backend API](#backend-api)
  - [API Endpoints](#api-endpoints)
  - [Scheduler and Run Coordination](#scheduler-and-run-coordination)
  - [Publishing Pipeline](#publishing-pipeline)
- [Copytrade System](#copytrade-system)
- [Data Sources and Market Intelligence](#data-sources-and-market-intelligence)
- [Database Schema](#database-schema)
- [Deployment](#deployment)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [Use of AI Tools](#use-of-ai-tools)
- [Team](#team)
- [License](#license)

---

## Project Overview

Omen is an autonomous market-intelligence swarm that coordinates specialized AI agents across a decentralized peer-to-peer network to produce verifiable trading signals and long-form market intelligence reports. The system operates without human intervention on a configurable hourly schedule, scanning the cryptocurrency market, conducting multi-source research, generating technical and fundamental analysis, applying adversarial quality review, synthesizing narrative intelligence, and publishing approved outputs to social platforms.

What distinguishes Omen from conventional trading bots or market dashboards is the intersection of three properties: genuine agent autonomy through a LangGraph-based execution graph with conditional branching and repair loops, decentralized inter-agent communication through Gensyn AXL with no centralized message broker, and cryptographic proof provenance through 0G protocol infrastructure covering storage, compute verification, on-chain anchoring, and intelligent NFT minting.

Every swarm run produces a chain of inspectable evidence: AXL message envelopes with peer IDs and delivery receipts, 0G Storage artifacts with durable locators, 0G Compute adjudication results with verifiable inference, on-chain manifest anchors on 0G Chain through the OmenRunRegistry contract, and optionally an ERC-7857 iNFT that embeds the encrypted swarm intelligence as transferable on-chain property.

The system is designed for hackathon judges who need to verify, within a short live review, that the swarm is real, technically deep, and produces useful output rather than a scripted demonstration.

---

## Problem Statement

The crypto market intelligence space suffers from three structural problems.

First, most market analysis is produced by single-agent systems or monolithic pipelines that lack internal adversarial review. A scanner finds a candidate, an analyst generates a thesis, and the output is published without independent critique. This produces overconfident signals with no mechanism for self-correction.

Second, existing autonomous agent systems typically run in-process with shared memory, making it impossible to verify that agents are genuinely independent rather than reading from the same state. Without separate runtime identities and auditable communication channels, claims of multi-agent coordination are unfalsifiable.

Third, market intelligence outputs are ephemeral. Once a signal or report is published, there is no durable proof trail linking the output back to the specific research evidence, model reasoning, and infrastructure decisions that produced it. Users and auditors cannot trace a published signal to its origin.

Omen addresses all three problems. The swarm includes an adversarial critic agent with repair loops, agents communicate through AXL with separate peer identities across distinct Fly.io deployments, and every run produces a manifest of proof artifacts anchored on 0G Chain.

---

## Architecture

### System Design

Omen is structured as a pnpm monorepo with a clear separation between the agent intelligence layer, the protocol integration layer, the persistence layer, and the presentation layer.

```
                                    +------------------+
                                    |   Frontend       |
                                    |   (Vite + React) |
                                    +--------+---------+
                                             |
                                             | REST API
                                             |
                                    +--------+---------+
                                    |   Backend        |
                                    |   (Express)      |
                                    +--------+---------+
                                             |
                          +------------------+------------------+
                          |                  |                  |
                 +--------+-------+ +--------+-------+ +-------+--------+
                 |  Agent Swarm   | |  AXL Transport | |  0G Protocol   |
                 |  (LangGraph)   | |  (A2A + MCP)   | |  (Storage/     |
                 |                | |                | |   Compute/     |
                 |  11 Roles      | |  12 Fly Apps   | |   Chain/iNFT)  |
                 +--------+-------+ +--------+-------+ +-------+--------+
                          |                  |                  |
                          +------------------+------------------+
                                             |
                                    +--------+---------+
                                    |   Supabase       |
                                    |   (PostgreSQL)   |
                                    +------------------+
```

The backend orchestrates the swarm execution pipeline, delegates agent work through AXL to remote peer nodes, persists state and events to Supabase, publishes proof artifacts to 0G Storage, anchors manifests on 0G Chain, and serves the REST API consumed by the frontend dashboard.

### Monorepo Structure

```
omen/
  backend/               Express API server, swarm pipeline, scheduler, publishers
  frontend/              Vite + React dashboard with evidence visualization
  contracts/             Solidity smart contracts (iNFT, Verifier, RunRegistry)
  packages/
    agents/              Agent definitions, prompts, LLM clients, quality gates
    axl/                 AXL adapter, A2A client, MCP service contracts, topology
    zero-g/              0G Storage, Compute, Chain, iNFT, proof registry
    db/                  Supabase client, repositories, realtime events
    market-data/         Binance, CoinGecko, CoinMarketCap, Birdeye, DeFiLlama
    indicators/          Technical indicators, chart analysis
    shared/              Shared types, schemas, constants
    execution/           Execution engine interfaces
  scripts/               AXL node launchers, Solidity compiler
  deploy/                Fly.io configuration for AXL bridge nodes
  specs/                 Specification documents
  langgraphjs/           LangGraph.js framework (vendored)
```

### Technology Stack

| Layer                 | Technology                                                               |
| --------------------- | ------------------------------------------------------------------------ |
| Runtime               | Node.js 24, TypeScript 5.8                                               |
| Agent Framework       | LangGraph.js (directed graph with conditional edges)                     |
| LLM Providers         | OpenAI (GPT-5-nano default), Grok-4 (scanner), 0G Compute (adjudication) |
| Agent Communication   | Gensyn AXL (A2A protocol, MCP services, peer-to-peer encryption)         |
| Decentralized Storage | 0G Storage (KV state, Log entries, File artifacts)                       |
| Verifiable Compute    | 0G Compute (independent adjudication inference)                          |
| On-Chain Proofs       | 0G Chain (OmenRunRegistry, OmenAgentINFT, OmenAgentVerifier)             |
| Database              | Supabase (PostgreSQL with Row Level Security)                            |
| Frontend              | React 19, Vite 5, TailwindCSS 3, Recharts, Lightweight Charts            |
| Backend               | Express 5, Helmet, CORS, Morgan                                          |
| Image Generation      | Hugging Face Inference (intel report cover images)                       |
| Social Publishing     | TwitterAPI.io (X/Twitter posts), Telegram Bot API                        |
| Deployment            | Vercel (frontend), Heroku (backend), Fly.io (AXL nodes)                  |
| Package Manager       | pnpm 10 with Turborepo                                                   |
| Smart Contracts       | Solidity 0.8.24                                                          |
| Trading               | Hyperliquid SDK (copytrade execution)                                    |

---

## Agent Swarm

Omen's intelligence layer is built on a LangGraph-based directed execution graph. Each swarm run traverses a sequence of specialized agent nodes, where each node receives structured input from the accumulated swarm state, invokes an LLM with a role-specific prompt, validates the output against a Zod schema, and returns a typed result that updates the shared state for downstream nodes.

The graph supports conditional branching. If the market bias is neutral, the scanner is skipped and the run proceeds directly to the intel synthesis path. If the critic rejects a thesis but marks it as repairable, the graph loops back to the analyst for a second attempt. If the critic rejects definitively, the graph routes to the intel path to produce a market narrative report instead of a trading signal.

### Swarm Roles

The swarm consists of eleven specialized agent roles, each with its own prompt template, input/output schema, and LLM configuration:

**Market Bias Agent** -- Establishes the macro directional bias (LONG, SHORT, or NEUTRAL) by analyzing market snapshots and prevailing narratives. This bias frames every downstream decision: which candidates to scan, how to weight evidence, and what risk posture to adopt. The reasoning output is persisted and visible in the dashboard.

**Scanner Agent** -- Scans the configured market universe (a curated list of tradeable symbols) for candidates that align with the established bias. The scanner applies initial filtering based on volume, momentum, and narrative attention. It returns up to three active candidates, each tagged with a direction hint, a reason for selection, and a dedupe key to prevent re-scanning the same opportunity across consecutive runs.

**Research Agent** -- Conducts multi-source research on the top candidate. The research agent queries Binance for OHLCV candle data, CoinGecko for fundamental metrics, CoinMarketCap for market cap and supply data, Birdeye for on-chain token analytics, and DeFiLlama for TVL and protocol flow data. It assembles structured evidence items across categories: market, technical, liquidity, funding, fundamental, catalyst, sentiment, and chart. Each evidence item includes a source label, source URL, summary, and optional structured data payload.

**Chart Vision Agent** -- Generates multi-timeframe technical chart analysis using vision-capable LLMs. The chart vision agent renders candlestick charts through Lightweight Charts, captures them as images, and submits them to a vision model for pattern recognition. It produces frame-level analysis for each timeframe and a consolidated chart summary that feeds into the analyst's thesis construction.

**Analyst Agent** -- Synthesizes all available evidence (research, chart vision, market bias reasoning) into a structured trading thesis. The thesis includes asset, direction, confidence score (0-100), risk/reward ratio, entry zone, target prices, stop loss, order type (market or limit), trading style (day trade or swing), expected duration, confluence factors, uncertainty notes, and missing data acknowledgments. When operating in repair mode after a critic rejection, the analyst receives the previous thesis and the critic's specific objections to address.

**Critic Agent** -- Performs adversarial review of the analyst's thesis against the evidence base and configurable quality thresholds. The critic evaluates minimum confidence, minimum risk/reward ratio, minimum confluence count, and internal consistency. It returns a decision (approved, rejected, or watchlist_only), a list of objections, blocking reasons, and a repairable flag indicating whether the thesis could be improved with targeted revisions. If repairable and no repair attempt has been made, the graph loops back to the analyst.

**Intel Agent** -- Synthesizes a narrative market intelligence report from the available context: bias reasoning, candidate analysis, evidence items, chart summaries, thesis drafts, and critic reviews. The intel agent produces reports across five categories: market_update, narrative_shift, token_watch, macro, and opportunity. Each report includes a title, summary, body, confidence score, importance score, and associated symbols. The intel agent also receives recent intel history and recent post context to avoid repetition.

**Generator Agent** -- Transforms the intel report into publishable content formats. The generator produces a refined topic, a tweet-length summary, a full blog post with markdown formatting, and an image generation prompt for the cover illustration. The image prompt is carefully constructed to avoid any text, ticker symbols, logos, or identifiable brand marks.

**Writer Agent** -- Produces long-form article content from the intel report and generated content. The writer node performs a direct peer-to-peer AXL MCP call to the memory node to retrieve historical context before drafting, demonstrating role-to-role communication that bypasses the orchestrator.

**Memory (Checkpoint) Node** -- Persists the current swarm state as a durable checkpoint on 0G Storage. The checkpoint includes the full state delta, proof artifact references, and a checkpoint label. The checkpoint node uses 0G KV Store for real-time state snapshots and 0G Log Store for append-only history. It returns a checkpoint reference ID that links the run to its durable storage location.

**Publisher Agent** -- Makes the final routing decision. If the critic approved the thesis, the publisher formats a trading signal with all required fields. If the run produced intel without a signal, the publisher packages the intel report for publication. If neither path produced output, it records a no_conviction outcome. The publisher also prepares social media drafts (signal alerts, intel summaries, and intel threads) for downstream posting to X/Twitter and Telegram.

### Swarm Execution Graph

```
market-bias-agent
      |
      +--[LONG/SHORT]--> scanner-agent --> research-agent --> chart-vision-agent
      |                                                              |
      +--[NEUTRAL]--+                                         analyst-agent
                    |                                               |
                    |                                         critic-agent
                    |                                          /         \
                    |                              [approved] /           \ [rejected]
                    |                                        /             \
                    |                               checkpoint       [repairable?]
                    |                                   |              /        \
                    |                            publisher-agent    [yes]      [no]
                    |                                              /            \
                    |                                     analyst-agent    intel-agent
                    |                                          |               |
                    +-----------------------------> intel-agent          generator-agent
                                                        |                     |
                                                  generator-agent       writer-agent
                                                        |                     |
                                                  writer-agent          checkpoint
                                                        |                     |
                                                  checkpoint           publisher-agent
                                                        |
                                                  publisher-agent
```

### Quality Gates and Repair Loops

The swarm implements a multi-layer quality assurance system:

1. **Schema Validation** -- Every agent output is validated against a Zod schema before it updates the swarm state. Malformed outputs cause the step to fail rather than corrupt downstream processing.

2. **Critic Gate** -- The critic agent enforces configurable quality thresholds (minimum confidence, minimum risk/reward, minimum confluences). Theses that fail these thresholds are rejected with specific objections.

3. **Repair Loop** -- If the critic marks a rejection as repairable and no repair attempt has been made, the graph routes back to the analyst with the previous thesis and critic objections. The analyst must address each objection specifically. Only one repair attempt is permitted per run to prevent infinite loops.

4. **0G Compute Adjudication** -- When 0G Compute is configured, an independent adjudication step runs the thesis and evidence through a separate model (Qwen 2.5 7B Instruct) on 0G's verifiable compute infrastructure. The adjudicator returns an independent verdict, confidence score, and rationale. This provides a second-opinion check from infrastructure that is independent of the primary LLM provider.

5. **Daily Signal Limit** -- The pipeline enforces a rolling 24-hour signal limit to prevent overproduction. When the limit is reached, signal generation is disabled and the run routes to the intel-only path with an explicit reason recorded in the swarm state.

---

## AXL Integration (Gensyn)

Omen uses Gensyn AXL as the sole communication layer for inter-agent coordination. The integration is not a wrapper around a centralized message broker. Each swarm role runs as an independently deployed application with its own AXL node binary, unique cryptographic peer identity, local MCP router, role-specific MCP service host, and A2A callback server.

### Deployed AXL Network

The production swarm is deployed as twelve separate Fly.io applications:

| Role         | Fly App                 | AXL Peer ID                 |
| ------------ | ----------------------- | --------------------------- |
| orchestrator | `omen-axl-node`         | `5a0c250776116d3c...ddf239` |
| market_bias  | `omen-axl-market-bias`  | `f49cc2cf8f293c41...b6bf1`  |
| scanner      | `omen-axl-scanner`      | `75f01a9f5b3403b6...f1f9d8` |
| research     | `omen-axl-research`     | `26525371a3622...a9a09ed`   |
| chart_vision | `omen-axl-chart-vision` | `394005c77faf...c90d04`     |
| analyst      | `omen-axl-analyst`      | `9926348dd39a...121d1c`     |
| critic       | `omen-axl-critic`       | `62070e8c1099...cddebc`     |
| intel        | `omen-axl-intel`        | `ea5590d48048...ba237b`     |
| generator    | `omen-axl-generator`    | `17e9e6c75f85...255989`     |
| writer       | `omen-axl-writer`       | `5d138fdd6e4b...d40a7ca6`   |
| memory       | `omen-axl-memory`       | `b9c37993dbe7...e026e8`     |
| publisher    | `omen-axl-publisher`    | `14d3925be85c...91b373`     |

Each deployed application runs five processes: the AXL node binary for peer-to-peer networking, a public HTTP proxy for external access, an MCP router for service discovery, an Omen MCP role host exposing the agent's capabilities as MCP tools, and an A2A callback server for receiving delegated work from the orchestrator.

### A2A Delegation Protocol

The orchestrator delegates work to role nodes using the Agent-to-Agent (A2A) protocol over AXL. When the swarm graph reaches a step that maps to a remote role, the `OrchestratorDelegator` constructs an A2A delegation request containing the step input, target peer ID, and correlation metadata. The request is sent through the AXL HTTP adapter to the orchestrator's local AXL node, which encrypts and routes it to the target peer.

The target role node receives the delegation through its A2A callback server, deserializes the input, invokes the role's MCP tool, and returns the result through AXL back to the orchestrator. The `ResponseCorrelator` matches incoming responses to pending delegations using correlation IDs.

All AXL messages are recorded in the `axl_messages` database table with sender/receiver agent IDs, roles, transport kind (send, a2a, or mcp), delivery status, and optional durable storage references.

### MCP Service Layer

Each role node exposes its agent capabilities as MCP (Model Context Protocol) tools. The MCP service definitions are implemented in `backend/src/nodes/services/`:

- `market-bias-mcp.ts` -- Exposes `market_bias.generate` for macro bias assessment
- `scanner-mcp.ts` -- Exposes `scan.candidates` for market scanning
- `research-mcp.ts` -- Exposes `research.investigate` for multi-source research
- `chart-vision-mcp.ts` -- Exposes `chart_vision.analyze` for technical chart analysis
- `analyst-mcp.ts` -- Exposes `analyst.synthesize` for thesis generation
- `critic-mcp.ts` -- Exposes `critic.review` for adversarial evaluation
- `intel-mcp.ts` -- Exposes `intel.synthesize` for narrative intelligence
- `generator-mcp.ts` -- Exposes `generator.produce` for content generation
- `writer-mcp.ts` -- Exposes `writer.article` for long-form content
- `memory-mcp.ts` -- Exposes `memory.recall` and `memory.store` for persistent context
- `publisher-mcp.ts` -- Exposes `publisher.finalize` for output routing

Each MCP service registers itself with the AXL MCP router on startup, making it discoverable by other nodes in the mesh network.

### Writer-to-Memory Peer Communication

A distinguishing feature of Omen's AXL integration is direct role-to-role communication that bypasses the orchestrator. During the `writer.article` step, the writer node performs a peer-to-peer AXL MCP call to the memory node using the `memory.recall` method. The writer sends a recall request to the memory node's peer ID, receives historical context, and incorporates it into the article draft.

This is verified by the A2A verifier, which confirms:

```json
{
  "hasArticle": true,
  "peerContext": {
    "sourcePeerId": "b9c37993dbe718883eb6904cbef54d1687c1f43160677bee55342eab71e026e8",
    "service": "memory",
    "method": "memory.recall"
  }
}
```

This proves that the writer node reached the separate memory node by peer ID and incorporated returned context into its result, without orchestrator mediation.

### Topology and Service Registry

The backend maintains a live view of the AXL network topology through the `TopologyPoller` and `ServiceRegistrySync` modules. The topology endpoint (`/api/topology`) returns the current peer graph, including peer IDs, online status, registered services, latency measurements, and last-seen timestamps.

The `PeerFailover` module handles degraded peers by tracking heartbeat failures and routing around offline nodes. Service registry snapshots are persisted to the `service_registry_snapshots` table for historical inspection.

### Verification

The repository includes a comprehensive A2A verification suite (`pnpm run axl:verify:a2a`) that validates the deployed AXL network:

1. Sends A2A delegation requests from the orchestrator node to each of the eleven role peer IDs
2. Validates that each role response completes successfully
3. Validates each response against the role's production output schema
4. Confirms the writer's peer-to-peer memory recall context
5. Reports the exact target peer ID used for each delegation

The verifier supports profile-based execution: the `core` profile tests the critical path (market_bias, scanner, research, analyst, critic), while the default profile tests all eleven roles.

---

## 0G Integration

Omen integrates with the 0G protocol across four layers: decentralized storage for durable state and artifacts, verifiable compute for independent adjudication, on-chain anchoring for proof permanence, and iNFT minting for swarm intelligence ownership.

### 0G Storage

The `@omen/zero-g` package provides three storage adapters:

**KV State Store** (`zero-g-state-store.ts`) -- Persists real-time swarm state snapshots as key-value pairs on 0G's KV node infrastructure. The checkpoint node writes a compact representation of the swarm state at milestone steps (after the checkpoint node and after the publisher agent). Keys are namespaced using a seed-based scheme (`omen-zero-g-kv-v1`) to prevent collisions. Each write returns a locator that is stored as a `zero_g_refs` record with ref_type `kv_state`.

**Log Store** (`zero-g-log-store.ts`) -- Appends immutable log entries to 0G's append-only log infrastructure. The pipeline writes structured event records at each checkpoint, creating a tamper-evident history of the run. Each entry includes the step name, state delta summary, and timestamp. Log entries are referenced with ref_type `log_entry` or `log_bundle`.

**File Store** (`zero-g-file-store.ts`) -- Publishes larger artifacts (evidence bundles, report bundles, manifests) as files to 0G Storage. The file store handles upload, receives a durable locator, and records the reference with ref_type `file_artifact`. Evidence bundles contain all structured evidence items from a run. Report bundles contain the full signal or intel report with metadata. Manifests aggregate all proof references from a run into a single root document.

The storage adapter (`storage-adapter.ts`) wraps the 0G TypeScript SDK and handles connection configuration, request timeouts, expected replica counts, and error recovery.

### 0G Compute

When configured, the pipeline invokes 0G Compute for an independent adjudication step after the local critic review. The `ZeroGAdjudication` module constructs a structured prompt containing the thesis, evidence, and local critic decision, then submits it to a model hosted on 0G's compute infrastructure (default: Qwen 2.5 7B Instruct).

The adjudication prompt requests a structured response with three fields: VERDICT (approved or rejected), CONFIDENCE (integer 0-100), and RATIONALE (one sentence). The response is parsed and recorded as a `compute_result` proof artifact with the model identifier and compute job metadata.

The `ZeroGReportSynthesis` module provides a secondary compute capability for synthesizing analytical reports through 0G Compute when additional verification is needed.

The `ComputeProofRecorder` publisher persists compute proof artifacts to the database with the 0G compute job ID, model used, input hash, and output preview.

### 0G Chain

The `ZeroGProofAnchor` module anchors run manifests on 0G Chain (Galileo testnet, chain ID 16602) through the `OmenRunRegistry` smart contract. After a run completes and all proof artifacts are assembled, the pipeline:

1. Builds a run manifest aggregating all proof artifact references
2. Publishes the manifest to 0G Storage as a file artifact
3. Computes the manifest root hash (keccak256 of the manifest content)
4. Calls `OmenRunRegistry.anchorRun(runId, manifestRoot, manifestUri)` on 0G Chain
5. Records the chain transaction as a `chain_proof` artifact with the explorer URL

The chain adapter (`chain-adapter.ts`) handles wallet configuration, transaction signing, gas estimation, and explorer URL construction for the 0G Chain testnet.

### iNFT (ERC-7857)

Omen can mint an ERC-7857-compatible intelligent NFT that represents the entire autonomous swarm. After minting, completed swarm runs can append versioned encrypted intelligence records to the same token. The iNFT references encrypted swarm intelligence on 0G Storage and stores verifiable data hashes on 0G Chain. The intelligence bundle contains:

- The Omen swarm role graph definition
- All checked-in agent prompt source files
- The 0G Compute model used for adjudication
- A required 0G memory root or manifest root from a real swarm run

The mint process requires a real `OMEN_INFT_MEMORY_ROOT` from a completed 0G-backed run. The script refuses to mint placeholder intelligence, ensuring every minted iNFT is backed by genuine swarm execution evidence. When `OMEN_INFT_CONTRACT_ADDRESS`, `OMEN_INFT_TOKEN_ID`, and the owner public key are configured in the backend, each completed live run uploads a fresh encrypted bundle and records a new on-chain intelligence version.

The intelligence bundle is encrypted with AES-256-GCM, and the symmetric key is sealed with the owner's RSA-4096 public key. This ensures that only the private key holder can decrypt and inspect the embedded intelligence.

### Run Manifest and Proof Pipeline

Every swarm run produces a structured proof pipeline:

1. **Agent Events** -- Each checkpoint emits an agent event with the step name, status, summary, and trace payload. Events are persisted to the `agent_events` table.

2. **AXL Message Records** -- Every inter-agent communication through AXL is recorded with sender/receiver identities, message type, transport kind, and delivery status.

3. **0G Storage Artifacts** -- Evidence bundles, report bundles, and state checkpoints are published to 0G Storage with durable locators.

4. **0G Compute Proofs** -- Adjudication results include the compute job ID, model identifier, and verifiable output.

5. **Run Manifest** -- All proof artifacts are aggregated into a manifest document published to 0G Storage.

6. **Chain Anchor** -- The manifest root hash is anchored on 0G Chain through the OmenRunRegistry contract.

7. **Post Proofs** -- If the run produces a social media post, the post payload and result are recorded as separate proof artifacts.

All proof references are stored in the `zero_g_refs` table with ref types: `kv_state`, `log_entry`, `log_bundle`, `file_artifact`, `compute_job`, `compute_result`, `post_payload`, `post_result`, `manifest`, and `chain_proof`.

---

## Smart Contracts

Three Solidity contracts are deployed on 0G Chain (Galileo testnet):

### OmenAgentINFT

`contracts/OmenAgentINFT.sol` -- The primary iNFT contract implementing the ERC-7857 standard for intelligent NFTs. Key capabilities:

- **mint** -- Creates a new iNFT with encrypted intelligence data, sealed keys, an initial intelligence version, and verifiable data hashes. Requires non-empty intelligent data and encrypted URI.
- **updateIntelligence** -- Appends a new run-specific intelligence version with encrypted 0G URI, memory root hash, proof manifest hash, timestamp, and block number.
- **iTransfer** -- Transfers an iNFT with re-encryption proofs. The verifier validates transfer validity proofs before updating data hashes and ownership. Plain `transferFrom` is disabled so transfers cannot bypass the proof path.
- **iClone** -- Creates a copy of an iNFT with new data hashes for the recipient, preserving the original.
- **authorizeUsage** -- Grants usage rights to a specific address without transferring ownership.
- **revokeAuthorization** -- Removes previously granted usage rights.
- **delegateAccess** -- Designates an assistant address that can act on behalf of the user.
- **intelligentDataOf** -- Returns the array of intelligent data entries (description and hash) for a token.

The contract stores encrypted token URIs pointing to 0G Storage locations, and each token's intelligent data includes description strings and keccak256 data hashes that can be verified against the actual encrypted content.

### OmenAgentVerifier

`contracts/OmenAgentVerifier.sol` -- A production signer-based verifier for ERC-7857 transfer validity proofs. The verifier:

- Validates that access proof and ownership proof reference the same data hashes and public keys
- Requires a sealed key for data re-encryption
- Recovers the access assistant address from the access proof signature
- Recovers the attestor address from the ownership proof signature
- Rejects replayed nonces to prevent proof reuse
- Rejects signatures from untrusted attestors

The verifier supports both TEE and ZKP oracle types for ownership proofs and uses EIP-191 signed message recovery for signature validation.

### OmenRunRegistry

`contracts/OmenRunRegistry.sol` -- An on-chain registry for anchoring swarm run manifests. Each anchored run stores:

- The run ID as a string key
- The manifest root hash (bytes32)
- The manifest URI pointing to 0G Storage
- The anchorer address
- The anchor timestamp and block number

The `anchorRun` function emits a `RunAnchored` event with indexed fields for efficient querying. The `getRunAnchor` function allows anyone to retrieve the proof record for a given run ID.

---

## Frontend Dashboard

The frontend is a React 19 application built with Vite 5 and TailwindCSS, designed around an operational "Evidence Cockpit" aesthetic: carbon-black surfaces, forensic cyan accents, and structured information layers that make swarm execution evidence inspectable.

### Pages and Features

**Landing Page** (`/`) -- Public-facing introduction to the Omen system with live system status, feature explanations, and entry points to the dashboard.

**Dashboard Home** (`/app`) -- Operational overview displaying the latest signal, latest intelligence report, system status panel (run status, scheduler state, next run time, runtime mode, market bias), and a real-time terminal log of agent events. All data refreshes on a 30-second interval.

**Signals Page** (`/app/signals`) -- Feed of all trading signals with confidence scores, direction indicators, entry/target/stop-loss prices, risk/reward ratios, PnL tracking, and proof badges. Each signal links to a detailed view with the full signal chart rendered through Lightweight Charts.

**Copytrade Page** (`/app/copytrade`) -- Automated copy-trading interface powered by Hyperliquid. Users can enroll a wallet, configure risk settings (position size, leverage, take-profit, stop-loss), and the system automatically executes trades based on approved signals. The page displays account status, active positions, trade history, and PnL metrics.

**Intel Page** (`/app/intel`) -- Feed of market intelligence reports with category badges, confidence scores, and AI-generated cover images. Each report expands to a full blog-style view with rich markdown content. The page supports deep linking to individual reports.

**Analytics Page** (`/app/analytics`) -- Multi-tab analytics suite with four sub-pages:

- **Overview** -- High-level metrics dashboard with signal count, win rate, and activity charts
- **Performance** -- PnL tracking, asset performance table, and confidence-outcome correlation
- **Market** -- Token frequency analysis and mindshare distribution
- **Signals** -- Signal confidence distribution, direction breakdown, and status tracking

**Evidence Page** (`/app/evidence`) -- Comprehensive proof visualization for each swarm run. Displays:

- Run manifest panels with artifact counts and storage locators
- Chain anchor cards with transaction hashes and explorer links
- Compute proof cards with model identifiers and adjudication results
- iNFT proof cards with token IDs and encrypted storage references
- Sponsor proof summaries grouped by 0G and AXL integration depth
- Artifact lists with clickable 0G Storage locators

**Trace History Page** (`/app/traces`) -- Detailed AXL communication trace viewer. Shows the full swarm run modal with step-by-step execution timeline, AXL route visualization, peer topology panel, service registry state, and message-level inspection.

### Evidence and Proof Visualization

The frontend implements a proof badge system that aggregates proof artifacts into compact, inspectable badges displayed on signal and intel cards:

- **0G MANIFEST** -- Links to the run manifest on 0G Storage
- **COMPUTE HASH** -- Shows the 0G Compute adjudication result
- **AXL ROUTED** -- Indicates the signal was produced through AXL-routed agent communication
- **POST PROOF** -- Links to the social media post proof artifact
- **CHAIN ANCHOR** -- Links to the on-chain manifest anchor transaction

The `SponsorProofSummary` component provides a high-level view of 0G and AXL integration depth for each run, designed for quick judge comprehension.

### Analytics Suite

The analytics dashboard provides eleven chart components:

- `ActivityChart` -- Signal and intel production over time
- `WinRateChart` -- Historical win rate tracking
- `PnLChart` -- Cumulative profit and loss
- `SignalConfidenceChart` -- Confidence score distribution
- `ConfidenceOutcomeChart` -- Correlation between confidence and actual outcomes
- `DirectionBreakdownChart` -- LONG vs SHORT signal distribution
- `SignalStatusChart` -- Signal lifecycle status tracking
- `TokenFrequencyChart` -- Most frequently analyzed tokens
- `MindshareChart` -- Market narrative mindshare distribution
- `AssetPerformanceTable` -- Per-asset performance metrics table

---

## Backend API

The backend is an Express 5 server that serves the REST API, orchestrates the swarm pipeline, manages the hourly scheduler, and coordinates all publishing side effects.

### API Endpoints

| Method | Path                           | Description                                               |
| ------ | ------------------------------ | --------------------------------------------------------- |
| GET    | `/api/health`                  | Health check                                              |
| GET    | `/api/status`                  | Runtime status with scheduler state                       |
| GET    | `/api/runs`                    | List of swarm runs with status and outcome                |
| GET    | `/api/dashboard/summary`       | Dashboard summary with latest signal, intel, and post IDs |
| GET    | `/api/dashboard/scheduler`     | Scheduler status (enabled, running, next run, last run)   |
| GET    | `/api/signals`                 | Signal feed with pagination                               |
| GET    | `/api/signals/:id`             | Signal detail with full thesis and evidence               |
| GET    | `/api/signals/:id/chart`       | Signal chart data for Lightweight Charts                  |
| GET    | `/api/signals/:id/candles`     | OHLCV candle data for signal charting                     |
| GET    | `/api/intel`                   | Intel feed with pagination                                |
| GET    | `/api/intel/:id`               | Intel detail with full body and metadata                  |
| GET    | `/api/analytics`               | Analytics snapshot feed                                   |
| GET    | `/api/analytics/latest`        | Latest analytics snapshot                                 |
| GET    | `/api/topology`                | Live AXL network topology                                 |
| GET    | `/api/proofs`                  | Proof artifact feed                                       |
| GET    | `/api/proofs/:runId`           | Proof detail for a specific run                           |
| GET    | `/api/posts`                   | Outbound post feed                                        |
| GET    | `/api/posts/:id`               | Post status detail                                        |
| GET    | `/api/logs`                    | Agent event log feed                                      |
| GET    | `/api/inft`                    | iNFT metadata and proof summary                           |
| GET    | `/api/copytrade/account`       | Copytrade account info                                    |
| GET    | `/api/copytrade/status`        | Copytrade enrollment status                               |
| GET    | `/api/copytrade/dashboard`     | Copytrade dashboard with positions and PnL                |
| POST   | `/api/copytrade/prepare`       | Prepare copytrade enrollment                              |
| POST   | `/api/copytrade/finalize`      | Finalize copytrade enrollment with signature              |
| PATCH  | `/api/copytrade/risk-settings` | Update copytrade risk settings                            |

### Scheduler and Run Coordination

The `HourlyScheduler` manages automated swarm execution:

- Configurable interval (default: 60 minutes)
- Persisted last-run timestamp to survive dyno restarts
- Run lock to prevent concurrent execution
- Overlap detection and prevention
- Automatic retry with fresh run ID on failure
- Optional pause-on-failure behavior
- Failure notification through Telegram

The `DefaultRunCoordinator` wraps the pipeline with retry logic and failed-run cleanup. If a run fails, the coordinator deletes the partial run cascade from the database and retries with a new run ID (configurable max retries, default: 1).

### Publishing Pipeline

After each swarm run, the pipeline executes a series of publishers:

1. **EventPublisher** -- Persists agent events to the `agent_events` table
2. **AxlMessageRecorder** -- Persists AXL message envelopes to `axl_messages`
3. **ZeroGRefRecorder** -- Persists 0G storage references to `zero_g_refs`
4. **ZeroGPublisher** -- Publishes artifacts to 0G Storage (evidence bundles, state checkpoints)
5. **EvidenceBundlePublisher** -- Assembles and publishes the evidence bundle
6. **ReportBundlePublisher** -- Assembles and publishes the signal or intel report bundle
7. **ComputeProofRecorder** -- Persists 0G Compute proof artifacts
8. **RunManifestPublisher** -- Builds and publishes the run manifest, anchors on chain
9. **PostPublisher** -- Formats and posts to X/Twitter through the post worker
10. **PostProofPublisher** -- Records post payloads and results as proof artifacts
11. **PostResultRecorder** -- Updates post status after delivery

The post worker implements a state machine (`queued -> formatting -> ready -> posting -> posted/failed`) with rate limiting and error recovery.

---

## Copytrade System

Omen includes a production-grade automated copy-trading system built on Hyperliquid:

**Enrollment Flow** -- Users prepare an enrollment by specifying their wallet address, target chain (Mainnet or Testnet), and risk settings. The system generates a dedicated agent wallet, encrypts the private key with AES-256, and stores the enrollment. The user signs an approval nonce, and the system finalizes the enrollment by submitting the agent wallet approval to Hyperliquid.

**Signal Monitoring** -- The `SignalMonitorService` polls for new approved signals at a configurable interval (default: 20 seconds). When a new signal is detected, it checks all active copytrade enrollments and determines which trades to execute based on the signal's direction, confidence, and the user's risk settings.

**Trade Execution** -- The `CopytradeExecutorService` manages the full trade lifecycle:

- Opens positions with configurable leverage and position sizing
- Sets take-profit and stop-loss orders
- Monitors positions for TP/SL hits
- Closes positions and records PnL
- Handles partial fills and execution failures

**Risk Management** -- Each enrollment has configurable risk settings including maximum position size (USD), leverage limits, take-profit percentage, stop-loss percentage, and maximum concurrent positions.

The copytrade system operates on real Hyperliquid infrastructure (Mainnet or Testnet) with no mock or simulated execution.

---

## Data Sources and Market Intelligence

The `@omen/market-data` package integrates with five external data providers:

**Binance** -- OHLCV candlestick data, 24-hour ticker statistics, order book depth, and recent trades. Used by the research agent for technical price data and by the chart vision agent for chart rendering.

**CoinGecko** -- Token metadata, market cap rankings, price change percentages, trading volume, circulating supply, and market dominance. Used for fundamental metrics and cross-market context.

**CoinMarketCap (CMC)** -- Market cap rankings, supply metrics, platform metadata, and category classification. Provides supplementary fundamental data and broader market context.

**Birdeye** -- On-chain token analytics for Solana and EVM chains, including holder distribution, liquidity depth, transaction volume, and token security scores. Used for on-chain evidence and DeFi token assessment.

**DeFiLlama** -- Protocol TVL tracking, TVL change rates, chain distribution, and protocol category data. Used for fundamental DeFi protocol analysis and liquidity flow assessment.

The `@omen/indicators` package provides technical analysis:

- **Basic Indicators** -- Moving averages (SMA, EMA), RSI, MACD, Bollinger Bands, volume analysis
- **Chart Analysis** -- Multi-timeframe chart rendering and pattern recognition through vision models

All data provider clients implement key rotation (multiple API keys per provider), request timeout handling, and graceful degradation when a provider is unavailable.

---

## Database Schema

The Supabase PostgreSQL database contains eleven tables:

| Table                        | Purpose                                                               |
| ---------------------------- | --------------------------------------------------------------------- |
| `runs`                       | Swarm run records with status, mode, market bias, outcome, and timing |
| `signals`                    | Trading signals with thesis fields, price levels, PnL tracking        |
| `intels`                     | Intelligence reports with title, body, category, confidence, image    |
| `agent_nodes`                | Agent node registry with role, transport, status, and peer ID         |
| `agent_events`               | Timestamped agent lifecycle events with trace payloads                |
| `axl_messages`               | AXL communication records with sender/receiver and delivery status    |
| `zero_g_refs`                | 0G Storage/Compute/Chain proof artifact references                    |
| `outbound_posts`             | Social media post queue with status machine tracking                  |
| `analytics_snapshots`        | Pre-computed analytics data for dashboard charts                      |
| `app_config`                 | Runtime configuration with mode, universe, thresholds                 |
| `copytrade_enrollments`      | Copytrade user enrollments with encrypted agent keys                  |
| `copytrade_trades`           | Individual copytrade position records with PnL                        |
| `service_registry_snapshots` | AXL service registry state captures                                   |

All tables use UUID-based text primary keys, timestamp columns with timezone, and JSONB columns for flexible structured data. Foreign key constraints enforce referential integrity across runs, signals, intels, agent nodes, and proof references.

---

## Deployment

### Frontend (Vercel)

```bash
# Root directory: frontend
# Build command: cd .. && pnpm --filter omen-frontend build
# Output directory: dist
# Environment: VITE_API_BASE_URL=https://<backend>.herokuapp.com/api
```

### Backend (Heroku)

```bash
heroku create <app-name>
heroku buildpacks:set heroku/nodejs --app <app-name>
heroku config:set NODE_ENV=production SCHEDULER_ENABLED=true --app <app-name>
# Set all environment variables from backend/.env.example
git push heroku main
```

The backend runs as a single web dyno with an in-process hourly scheduler. The Procfile runs `pnpm start:backend` which executes the TypeScript source through tsx at runtime.

### AXL Nodes (Fly.io)

Each AXL role node is deployed as a separate Fly.io application:

```bash
fly apps create omen-axl-<role>
fly volumes create axl_data --size 1 --region sin --app omen-axl-<role>
fly secrets set AXL_PRIVATE_KEY_B64=<base64-pem> --app omen-axl-<role>
fly deploy -c deploy/fly/axl.fly.toml --app omen-axl-<role>
```

### Smart Contract Deployment

```bash
pnpm run contracts:compile          # Compile Solidity with solc
pnpm run inft:deploy                # Deploy OmenAgentVerifier + OmenAgentINFT
pnpm run inft:mint                  # Mint the swarm iNFT (requires real 0G memory root)
```

The `OmenRunRegistry` is deployed separately:

```bash
pnpm --filter @omen/zero-g deploy:run-registry
```

---

## Local Development

### Prerequisites

- Node.js 24
- pnpm 10
- PowerShell (for AXL node scripts)
- Supabase CLI (optional, for local database)

### Setup

```bash
git clone https://github.com/<org>/omen.git
cd omen
pnpm install
```

### Running

```bash
# Start both frontend and backend in parallel
pnpm dev

# Or individually
pnpm frontend    # Vite dev server on port 5173
pnpm backend     # Express server on port 4001
```

### Local AXL Swarm

```bash
# Start all 12 AXL nodes locally
pnpm run axl:start:demo

# Start core nodes only
pnpm run axl:start:demo:core

# Stop all local nodes
pnpm run axl:stop:demo

# Verify A2A communication
pnpm run axl:verify:a2a
```

### Database

```bash
pnpm supabase:start     # Start local Supabase
pnpm supabase:reset     # Reset and reseed database
pnpm supabase:status    # Check Supabase status
```

### Testing

```bash
pnpm test               # Unit + integration tests
pnpm test:unit          # Unit tests only
pnpm test:integration   # Integration tests only
pnpm test:e2e           # Playwright end-to-end tests
```

### Code Quality

```bash
pnpm lint               # ESLint across all packages
pnpm lint:fix           # Auto-fix lint issues
pnpm format             # Prettier formatting
pnpm typecheck          # TypeScript type checking
```

---

## Environment Variables

The system requires environment variables across three scopes. See the example files for complete reference:

- `backend/.env.example` -- Backend configuration (127 variables)
- `frontend/.env.example` -- Frontend configuration
- `deploy/env/fly.axl.env.example` -- AXL bridge node configuration

Key variable groups:

| Group          | Variables                                                 | Purpose                       |
| -------------- | --------------------------------------------------------- | ----------------------------- |
| Supabase       | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`               | Database access               |
| OpenAI         | `OPENAI_API_KEY`, `OPENAI_MODEL`                          | Primary LLM provider          |
| Scanner LLM    | `SCANNER_API_KEY`, `SCANNER_MODEL`                        | Scanner-specific LLM (Grok-4) |
| AXL            | `AXL_NODE_BASE_URL`, `AXL_*_NODE_ID` (x12)                | AXL peer network              |
| 0G Storage     | `ZERO_G_INDEXER_URL`, `ZERO_G_KV_NODE_URL`                | Decentralized storage         |
| 0G Compute     | `ZERO_G_COMPUTE_URL`, `ZERO_G_COMPUTE_API_KEY`            | Verifiable inference          |
| 0G Chain       | `ZERO_G_RPC_URL`, `ZERO_G_PRIVATE_KEY`, `ZERO_G_CHAIN_ID` | On-chain anchoring            |
| iNFT           | `OMEN_INFT_*` (x12)                                       | iNFT contract and mint config |
| Market Data    | `COINGECKO_API_KEY`, `BIRDEYE_API_KEY`, `CMC_API_KEY`     | Data providers                |
| Twitter        | `TWITTERAPI_API_KEY`, `TWITTERAPI_*`                      | X/Twitter posting             |
| Telegram       | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`                  | Telegram notifications        |
| Copytrade      | `FUTURES_ENCRYPTION_KEY`                                  | Agent key encryption          |
| Image Gen      | `HF_TOKEN` (x17)                                          | Hugging Face inference        |
| Object Storage | `R2_*`                                                    | Cloudflare R2 for images      |

---

## Use of AI Tools

This project was built with significant assistance from AI coding tools, in accordance with the hackathon guidelines on transparency and attribution.

### Tools Used

**Primary Development Assistant** -- OpenAI Codex with GPT-5.5 served as the primary coding assistant throughout the project. It was used extensively across all phases of development, from initial architecture planning and boilerplate scaffolding through to implementation of business logic, debugging, refactoring, and documentation.

### Scope of AI Assistance

AI assistance was integrated into the development workflow continuously rather than being confined to specific files or modules. The nature of working with an AI coding assistant means that its contributions are distributed throughout the codebase in a way that is difficult to isolate to individual files. Rather than generating entire modules wholesale, the assistant was used as a pair-programming partner: proposing implementations that were reviewed, modified, tested, and iterated upon by the team.

Specific areas where AI assistance was particularly active include:

- **Architecture and Design** -- Structuring the monorepo, defining package boundaries, and designing the agent-to-agent communication patterns
- **Agent Definitions and Prompts** -- Crafting the role-specific prompt templates and defining input/output schemas for each swarm agent
- **Protocol Integration** -- Implementing the AXL adapter layer, 0G storage/compute/chain integrations, and the proof pipeline
- **Smart Contracts** -- Developing the ERC-7857 iNFT contract, verifier, and run registry
- **Frontend Components** -- Building the dashboard UI components, chart integrations, and evidence visualization panels
- **Pipeline Logic** -- Implementing the swarm execution pipeline, checkpoint system, and publishing side effects
- **Testing and Debugging** -- Writing test cases, diagnosing runtime issues, and refining error handling

### Team Contributions

The team was responsible for all architectural decisions, product direction, system design, and quality standards. Every AI-generated suggestion was evaluated by team members before integration. The team directed the AI through specific requirements, rejected unsuitable outputs, and made independent design choices that shaped the final system. The AI tool accelerated implementation velocity but did not replace the team's judgment on what to build, how components should interact, or what quality bar the system should meet.

All specification files, planning artifacts, and design documents used to direct the AI are included in the repository under the `specs/` directory and project-level markdown files (`PRODUCT.md`, `DESIGN.md`, `DEPLOYMENT.md`, `AXL_DEMO.md`, `INFT_DEPLOYMENT.md`).

---

## Team

**Project** -- Omen

**Hackathon** -- Open Agents Hackathon by ETHGlobal

**Target Prizes:**

- 0G: Best Autonomous Agents, Swarms and iNFT Innovations ($7,500 pool)
- Gensyn: Best Application of Agent eXchange Layer (AXL) ($5,000 pool)

---

## Protocol Features Summary

### 0G Protocol Usage

| Feature              | SDK/API            | Implementation                                           |
| -------------------- | ------------------ | -------------------------------------------------------- |
| KV State Store       | 0G TypeScript SDK  | `packages/zero-g/src/storage/zero-g-state-store.ts`      |
| Log Store            | 0G TypeScript SDK  | `packages/zero-g/src/storage/zero-g-log-store.ts`        |
| File Store           | 0G TypeScript SDK  | `packages/zero-g/src/storage/zero-g-file-store.ts`       |
| Storage Adapter      | 0G TypeScript SDK  | `packages/zero-g/src/storage/storage-adapter.ts`         |
| Storage Namespace    | Custom             | `packages/zero-g/src/storage/namespace.ts`               |
| Compute Adapter      | 0G Compute API     | `packages/zero-g/src/compute/compute-adapter.ts`         |
| Compute Adjudication | 0G Compute API     | `packages/zero-g/src/compute/zero-g-adjudication.ts`     |
| Report Synthesis     | 0G Compute API     | `packages/zero-g/src/compute/zero-g-report-synthesis.ts` |
| Chain Adapter        | ethers.js + 0G RPC | `packages/zero-g/src/chain/chain-adapter.ts`             |
| Proof Anchor         | ethers.js + 0G RPC | `packages/zero-g/src/chain/proof-anchor.ts`              |
| Run Registry ABI     | Solidity ABI       | `packages/zero-g/src/chain/omen-run-registry.ts`         |
| iNFT ABI             | Solidity ABI       | `packages/zero-g/src/chain/omen-agent-inft.ts`           |
| Verifier ABI         | Solidity ABI       | `packages/zero-g/src/chain/omen-agent-verifier.ts`       |
| iNFT Encryption      | Node.js crypto     | `packages/zero-g/src/inft/encryption.ts`                 |
| Intelligence Bundle  | Custom             | `packages/zero-g/src/inft/omen-agent-intelligence.ts`    |
| Proof Registry       | Custom             | `packages/zero-g/src/proofs/proof-registry.ts`           |
| Manifest Builder     | Custom             | `packages/zero-g/src/proofs/run-manifest-builder.ts`     |

### AXL Protocol Usage

| Feature                | Protocol | Implementation                                        |
| ---------------------- | -------- | ----------------------------------------------------- |
| A2A Client             | AXL A2A  | `packages/axl/src/a2a/a2a-client.ts`                  |
| Delegation Contract    | AXL A2A  | `packages/axl/src/a2a/delegation-contract.ts`         |
| AXL Adapter            | AXL HTTP | `packages/axl/src/adapter/axl-adapter.ts`             |
| HTTP Adapter           | AXL HTTP | `packages/axl/src/adapter/axl-http-adapter.ts`        |
| MCP Service Contract   | AXL MCP  | `packages/axl/src/mcp/service-contract.ts`            |
| MCP Service Registry   | AXL MCP  | `packages/axl/src/mcp/service-registry.ts`            |
| HTTP Node Client       | AXL HTTP | `packages/axl/src/node-client/http-node-client.ts`    |
| Message Envelope       | Custom   | `packages/axl/src/message-envelope/omen-message.ts`   |
| Peer Status            | AXL      | `packages/axl/src/peer-status/peer-status.ts`         |
| Topology Snapshot      | AXL      | `packages/axl/src/topology/topology-snapshot.ts`      |
| Orchestrator Delegator | AXL A2A  | `backend/src/nodes/a2a/orchestrator-delegator.ts`     |
| Response Correlator    | AXL A2A  | `backend/src/nodes/a2a/response-correlator.ts`        |
| AXL Node Manager       | Custom   | `backend/src/nodes/axl-node-manager.ts`               |
| AXL Peer Registry      | Custom   | `backend/src/nodes/axl-peer-registry.ts`              |
| Topology Poller        | AXL      | `backend/src/nodes/topology/topology-poller.ts`       |
| Service Registry Sync  | AXL      | `backend/src/nodes/topology/service-registry-sync.ts` |
| Peer Failover          | Custom   | `backend/src/nodes/topology/peer-failover.ts`         |

---

## Swarm State Model

The swarm maintains a comprehensive state object (`SwarmState`) that accumulates data as agents execute. The state is immutable between steps -- each agent receives a snapshot and returns a delta that is merged into the next snapshot.

### State Fields

```typescript
{
  run: {                          // Run metadata and lifecycle
    id, mode, status, marketBias, startedAt, completedAt,
    triggeredBy, activeCandidateCount, currentCheckpointRefId,
    finalSignalId, finalIntelId, failureReason, outcome
  },
  config: {                       // Runtime configuration snapshot
    mode, marketUniverse, qualityThresholds,
    providers, postToXEnabled, scanIntervalMinutes
  },
  marketBiasReasoning: string,    // Market bias agent reasoning
  activeCandidates: [{            // Scanner output
    id, symbol, directionHint, reason, status, dedupeKey, missingDataNotes
  }],
  evidenceItems: [{               // Research agent output
    category, summary, sourceLabel, sourceUrl, structuredData
  }],
  chartVisionSummaries: string[], // Chart vision agent summaries
  thesisDrafts: [{                // Analyst agent output
    candidateId, asset, direction, confidence, riskReward,
    orderType, tradingStyle, expectedDuration,
    currentPrice, entryPrice, targetPrice, stopLoss,
    whyNow, confluences, uncertaintyNotes, missingDataNotes
  }],
  criticReviews: [{               // Critic agent output
    candidateId, decision, objections,
    forcedOutcomeReason, repairable, repairInstructions
  }],
  intelReports: [{                // Intel agent output
    topic, title, summary, insight, category,
    confidence, importanceScore, symbols, imagePrompt
  }],
  generatedIntelContents: [{      // Generator agent output
    topic, tweetText, blogPost, imagePrompt
  }],
  intelArticles: [{               // Writer agent output
    headline, body, sources
  }],
  publisherDrafts: [{             // Publisher agent output
    kind, headline, summary, text, metadata
  }],
  proofArtifacts: [],             // Accumulated proof references
  notes: string[],                // Execution trace notes
  errors: string[],               // Error messages
  signalRepairAttempts: number,   // Repair loop counter
  latestCheckpointRefId: string,  // 0G checkpoint reference
  activeTradeSymbols: string[],   // Currently traded symbols (copytrade)
  recentIntelHistory: [],         // Recent intel for dedup
  recentPostContext: [],          // Recent posts for dedup
  signalGenerationDisabledReason: string | null
}
```

The `mergeSwarmState` function performs a shallow merge of state deltas, preserving all fields not explicitly overridden by the delta. This ensures that downstream agents always receive the complete accumulated context from all upstream agents.

---

## Social Publishing

### X/Twitter Integration

The social publishing pipeline uses TwitterAPI.io for posting to X/Twitter. The implementation includes:

**Post Formatter** (`post-formatter.ts`) -- Transforms signals and intel reports into platform-appropriate formats:

- Signal alerts with direction, confidence, entry/target/stop prices, and risk/reward
- Intel summaries with title and key insight
- Intel threads with multi-tweet formatting for long-form content

**Post Worker** (`post-worker.ts`) -- Manages the posting lifecycle with a state machine:

1. `queued` -- Post is created and waiting for formatting
2. `formatting` -- Post content is being prepared
3. `ready` -- Post is formatted and waiting for delivery
4. `posting` -- Post is being sent to Twitter API
5. `posted` -- Post was successfully delivered (with published URL)
6. `failed` -- Post delivery failed (with error message)

**Rate Limiting** (`rate-limit-store.ts`) -- Tracks posting frequency to avoid API rate limits and content flooding.

**TwitterAPI Client** (`twitterapi-client.ts`) -- Wraps the TwitterAPI.io REST API with authentication, proxy support, cookie-based sessions, and error classification.

### Telegram Integration

The `TelegramService` sends notifications to a configured Telegram channel for both signals and intel reports. Telegram messages include the report title, summary, and a deep link back to the full intel page in the Omen dashboard.

### Post Proof Pipeline

Every social media post generates two proof artifacts:

- `post_payload` -- The formatted post content before delivery
- `post_result` -- The delivery result including the provider post ID and published URL

These artifacts are included in the run manifest, creating a verifiable link between the swarm's analysis pipeline and its public outputs.

---

## Security

### Encryption

- **Copytrade Agent Keys** -- Agent wallet private keys are encrypted with AES-256 using a server-side encryption key (`FUTURES_ENCRYPTION_KEY`) before storage in the database
- **iNFT Intelligence** -- Swarm intelligence bundles are encrypted with AES-256-GCM, with the symmetric key sealed using the owner's RSA-4096 public key
- **AXL Communication** -- All inter-agent communication through AXL is end-to-end encrypted by default through the AXL node binary

### API Security

- **CORS** -- The backend enforces origin-based CORS, allowing requests only from the configured `FRONTEND_ORIGIN`
- **Helmet** -- Standard HTTP security headers are applied through Helmet middleware
- **Input Validation** -- All agent inputs and outputs are validated against Zod schemas
- **Service Role Keys** -- Supabase access uses service role keys with Row Level Security policies

### Contract Security

- **Nonce Replay Protection** -- The `OmenAgentVerifier` rejects proof nonces that have already been consumed
- **Attestor Trust** -- Only addresses registered as trusted attestors can sign valid ownership proofs
- **Owner Guards** -- Critical contract functions (mint, set verifier, transfer ownership) are restricted to the contract owner

---

## Verification Checklist

For judges and reviewers, the following verification steps confirm the system's authenticity:

### AXL Verification

```bash
# Check live topology from the orchestrator
curl https://omen-axl-node.fly.dev/topology

# Check a role node has a different peer identity
curl https://omen-axl-writer.fly.dev/topology

# Run the full A2A verification suite
pnpm run axl:verify:a2a
```

Expected: 12 distinct peer IDs, all 11 role delegations complete with schema-valid responses, writer shows memory peer context.

### 0G Verification

```bash
# Check the run registry on 0G Chain explorer
# https://chainscan-galileo.0g.ai

# Verify a manifest anchor transaction
# Transaction hash is recorded in the proof artifacts for each run
```

Expected: `RunAnchored` events on 0G Chain with manifest root hashes and storage URIs.

### iNFT Verification

```bash
# Check the iNFT on 0G Chain explorer
# Contract address and token ID are in the INFT_DEPLOYMENT.md
```

Expected: Minted token with non-empty intelligent data hashes and encrypted storage URI.

---

## Team

**Project** -- Omen

**Hackathon** -- Open Agents Hackathon by ETHGlobal

**Target Prizes:**

- 0G: Best Autonomous Agents, Swarms and iNFT Innovations ($7,500 pool)
- Gensyn: Best Application of Agent eXchange Layer (AXL) ($5,000 pool)

---

## License

This project was built during the Open Agents Hackathon by ETHGlobal.
