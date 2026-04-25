# Data Model: Omen Autonomous Market-Intelligence Swarm

## Overview

The data model separates operator-facing query state in Supabase from decentralized durable memory in 0G. Supabase tables support dashboard views, filtering, pagination, and realtime subscriptions. 0G references are persisted as immutable pointers from those relational records.

## Entities

### Run

**Purpose**: Represents one swarm execution lifecycle.

**Fields**
- `id`: string, stable unique run ID
- `mode`: enum (`mocked`, `live`, `production_like`)
- `status`: enum (`queued`, `starting`, `running`, `completed`, `failed`, `cancelled`)
- `marketBias`: enum (`LONG`, `SHORT`, `NEUTRAL`, `UNKNOWN`)
- `startedAt`: timestamp
- `completedAt`: timestamp nullable
- `triggeredBy`: enum (`dashboard`, `scheduler`, `system`)
- `activeCandidateCount`: integer 0-3
- `finalSignalId`: string nullable
- `failureReason`: string nullable
- `currentCheckpointRefId`: string nullable
- `configSnapshot`: jsonb

**Relationships**
- One `Run` has many `AgentEvent`
- One `Run` has many `AXLMessage`
- One `Run` has many `ZeroGRef`
- One `Run` has many `SignalCandidate`
- One `Run` may yield zero or one final `Signal`

**Validation Rules**
- `activeCandidateCount <= 3`
- Only one final approved signal per run
- `completedAt` required when status is terminal

**LangGraph Mapping**
- `id` is also used as the LangGraph `thread_id` for checkpoints and replayable graph state.

### AgentNode

**Purpose**: Tracks logical node and role availability for the dashboard.

**Fields**
- `id`: string
- `role`: enum (`orchestrator`, `scanner`, `research`, `analyst`, `critic`, `publisher`, `memory`, `monitor`, `market_bias`, `chart_vision`)
- `transport`: enum (`axl`, `local`)
- `status`: enum (`online`, `degraded`, `offline`, `starting`)
- `peerId`: string nullable
- `lastHeartbeatAt`: timestamp
- `lastError`: string nullable
- `metadata`: jsonb

**Relationships**
- One `AgentNode` has many `AgentEvent`
- One `AgentNode` sends and receives many `AXLMessage`

### AgentEvent

**Purpose**: Unified live trace event for runtime and UI inspection.

**Fields**
- `id`: string
- `runId`: string
- `agentId`: string
- `eventType`: enum (`run_created`, `market_bias_generated`, `candidate_found`, `axl_message_sent`, `axl_message_received`, `zero_g_kv_write`, `zero_g_log_append`, `research_completed`, `chart_generated`, `thesis_generated`, `critic_decision`, `report_published`, `paper_position_created`, `monitor_update`, `reflection_written`, `warning`, `error`)
- `status`: enum (`info`, `success`, `warning`, `error`, `pending`)
- `payload`: jsonb
- `timestamp`: timestamp
- `axlMessageId`: string nullable
- `zeroGRefId`: string nullable
- `signalId`: string nullable

**Validation Rules**
- `runId` required
- `agentId` required
- payload must never include secrets

### AXLMessage

**Purpose**: Stored representation of inter-node messages shown in the dashboard.

**Fields**
- `id`: string
- `runId`: string
- `correlationId`: string
- `fromAgentId`: string
- `toAgentId`: string nullable
- `topic`: string nullable
- `messageType`: string
- `payload`: jsonb
- `transportKind`: enum (`send`, `a2a`, `mcp`)
- `deliveryStatus`: enum (`queued`, `sent`, `received`, `failed`)
- `timestamp`: timestamp
- `zeroGLogRefId`: string nullable

**Validation Rules**
- one of `toAgentId` or `topic` must be present
- `correlationId` required

### ZeroGRef

**Purpose**: User-visible pointer to decentralized memory or compute artifacts.

**Fields**
- `id`: string
- `runId`: string
- `signalId`: string nullable
- `refType`: enum (`kv_state`, `log_entry`, `log_bundle`, `compute_job`, `compute_result`, `chain_proof`)
- `key`: string nullable
- `locator`: string
- `metadata`: jsonb
- `createdAt`: timestamp

**Relationships**
- A `ZeroGRef` may be attached to many `AgentEvent`
- A `ZeroGRef` may be attached to one `Signal`

### SignalCandidate

**Purpose**: Tracks assets selected for deeper evaluation before final thesis generation.

**Fields**
- `id`: string
- `runId`: string
- `symbol`: string
- `sourceUniverse`: string
- `selectionReason`: text
- `dedupeKey`: string
- `liquidityStatus`: enum (`sufficient`, `weak`, `rejected`)
- `analysisStatus`: enum (`pending`, `researched`, `rejected`, `promoted`)
- `createdAt`: timestamp

### Signal

**Purpose**: Final actionable or watchlist/no-conviction published output.

**Fields**
- `id`: string
- `runId`: string
- `candidateId`: string nullable
- `asset`: string
- `direction`: enum (`LONG`, `SHORT`, `WATCHLIST`, `NONE`)
- `confidence`: integer
- `riskReward`: decimal nullable
- `entryZone`: jsonb nullable
- `invalidation`: jsonb nullable
- `targets`: jsonb nullable
- `whyNow`: text
- `uncertaintyNotes`: text
- `missingDataNotes`: text
- `criticDecision`: enum (`approved`, `rejected`, `watchlist_only`)
- `reportStatus`: enum (`draft`, `published`, `superseded`)
- `publishedAt`: timestamp nullable
- `finalReportRefId`: string nullable

**Validation Rules**
- `confidence >= 0 and <= 100`
- actionable signals require `confidence >= 85`
- actionable signals require `riskReward >= 2`
- all published signals require disclaimer-ready report content

### SignalEvidence

**Purpose**: Stores structured evidence packs for signal detail inspection.

**Fields**
- `id`: string
- `signalId`: string
- `category`: enum (`market`, `technical`, `liquidity`, `funding`, `fundamental`, `catalyst`, `sentiment`, `chart`)
- `summary`: text
- `structuredData`: jsonb
- `sourceList`: jsonb
- `chartAssetUrl`: string nullable
- `createdAt`: timestamp

### SignalStatusUpdate

**Purpose**: Tracks post-publication lifecycle changes.

**Fields**
- `id`: string
- `signalId`: string
- `status`: enum (`active`, `invalidated`, `target_hit`, `stopped`, `expired`, `watchlist_only`, `closed`)
- `priceContext`: jsonb nullable
- `notes`: text nullable
- `reflectionRefId`: string nullable
- `createdAt`: timestamp

### PaperPosition

**Purpose**: Represents simulated or testnet-only positions derived from approved signals.

**Fields**
- `id`: string
- `signalId`: string
- `asset`: string
- `direction`: enum (`LONG`, `SHORT`)
- `entryPrice`: decimal
- `stopPrice`: decimal
- `targets`: jsonb
- `riskPercent`: decimal
- `size`: decimal nullable
- `status`: enum (`open`, `target_hit`, `stopped`, `expired`, `closed`)
- `createdAt`: timestamp
- `updatedAt`: timestamp

### AppConfig

**Purpose**: Controls demo-safe runtime behavior.

**Fields**
- `id`: string
- `mode`: enum (`mocked`, `live`, `production_like`)
- `marketUniverse`: jsonb
- `qualityThresholds`: jsonb
- `providers`: jsonb
- `paperTradingEnabled`: boolean
- `testnetExecutionEnabled`: boolean
- `mainnetExecutionEnabled`: boolean
- `updatedAt`: timestamp

**Validation Rules**
- `mainnetExecutionEnabled` defaults to false
- enabling mainnet requires an explicit environment gate outside UI defaults

## Durable Memory Mapping

### 0G KV keys

- `runs/{runId}/market-bias`
- `runs/{runId}/checkpoint`
- `runs/{runId}/active-candidates`
- `runs/{runId}/agent-statuses`
- `signals/{signalId}/latest-status`

### 0G append-only artifacts

- `runs/{runId}/trace`
- `runs/{runId}/debate`
- `runs/{runId}/axl-receipts`
- `signals/{signalId}/final-report`
- `signals/{signalId}/reflections`

## State Transitions

### Run

`queued -> starting -> running -> completed|failed|cancelled`

### Candidate

`pending -> researched -> promoted|rejected`

### Signal

`draft -> published -> superseded`

### Paper Position

`open -> target_hit|stopped|expired|closed`

### Node

`starting -> online -> degraded|offline`
