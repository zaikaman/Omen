# Tasks: Omen Autonomous Market-Intelligence Swarm

**Input**: Design documents from `/specs/001-omen-swarm-runtime/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`

**Validation**: Every in-scope MVP story includes automated validation tasks because the feature specification explicitly requires unit tests, integration tests, and a deterministic demo walkthrough.

**Organization**: Tasks are grouped by MVP user story so the team can deliver the runtime, dashboard data, and X publishing flow in a strict order without pulling in post-MVP template features too early.

## Format: `[ID] [P?] [Story] Description`

- `[P]` marks tasks that can run in parallel when their dependencies are already satisfied.
- `[Story]` appears only on user-story tasks and maps to `US1` through `US3`.
- Every task includes exact file paths.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the monorepo, workspace tooling, and base package structure.

- [x] T001 Create pnpm workspace manifests in `package.json`, `pnpm-workspace.yaml`, and `turbo.json`
- [x] T002 Create shared TypeScript base configs in `tsconfig.json` and `tsconfig.base.json`
- [x] T003 [P] Create root quality tooling in `eslint.config.mjs`, `prettier.config.mjs`, and `.editorconfig`
- [x] T004 [P] Create a single root environment file and template in `.env` and `.env.example`
- [x] T005 Create package manifests for `frontend/package.json` and `backend/package.json`
- [x] T006 [P] Create package manifests for `packages/agents/package.json`, `packages/axl/package.json`, `packages/zero-g/package.json`, `packages/market-data/package.json`, `packages/db/package.json`, `packages/shared/package.json`, `packages/indicators/package.json`, and `packages/execution/package.json`
- [x] T007 [P] Create initial directory scaffolding placeholders in `frontend/src/.gitkeep`, `backend/src/.gitkeep`, `packages/*/src/.gitkeep`, `tests/integration/.gitkeep`, `tests/fixtures/.gitkeep`, and `tests/e2e/.gitkeep`
- [x] T008 Configure root scripts for linting, typechecking, testing, Supabase, and AXL node helpers in `package.json`

---

## Phase 2: MVP Foundation (Blocking Prerequisites)

**Purpose**: Build only the shared contracts and infrastructure needed for the hackathon MVP: LangGraph orchestration, hourly swarm scheduling, dashboard-readable state, 0G as canonical swarm memory/proof fabric, AXL as real peer-to-peer agent transport, and public X posting.

**Critical**: No user story work should start until this phase is complete.

**MVP Scope Lock**: If a task does not directly support the hourly run pipeline, dashboard data surfaces, sponsor proof points, or public X posting, defer it.

- [x] T009 Create shared MVP schema barrel and primitives in `packages/shared/src/schemas/index.ts`, `packages/shared/src/types/index.ts`, `packages/shared/src/constants/index.ts`, and `packages/shared/src/utils/result.ts`
- [x] T010 [P] Implement core runtime schemas for runs, intels, signals, agent events, outbound posts, analytics snapshots, config, envelopes, and proof artifacts in `packages/shared/src/schemas/run.ts`, `packages/shared/src/schemas/intel.ts`, `packages/shared/src/schemas/signal.ts`, `packages/shared/src/schemas/event.ts`, `packages/shared/src/schemas/post.ts`, `packages/shared/src/schemas/analytics.ts`, `packages/shared/src/schemas/config.ts`, `packages/shared/src/schemas/axl.ts`, and `packages/shared/src/schemas/proofs.ts`
- [x] T011 [P] Implement shared API contracts for dashboard summary, logs, scheduler status, intel feeds, signal feeds, and posting state in `packages/shared/src/schemas/api/dashboard.ts`, `packages/shared/src/schemas/api/intel.ts`, `packages/shared/src/schemas/api/signals.ts`, `packages/shared/src/schemas/api/logs.ts`, and `packages/shared/src/schemas/api/posts.ts`
- [x] T012 [P] Implement LangGraph runtime abstractions in `packages/agents/src/framework/agent-runtime.ts`, `packages/agents/src/framework/state.ts`, `packages/agents/src/framework/checkpointing.ts`, and `packages/agents/src/framework/graph-factory.ts`
- [x] T013 [P] Define LangGraph node IO contracts for orchestrator, scanner, research, analyst, critic, memory, and publisher roles in `packages/agents/src/contracts/orchestrator.ts`, `packages/agents/src/contracts/scanner.ts`, `packages/agents/src/contracts/research.ts`, `packages/agents/src/contracts/analyst.ts`, `packages/agents/src/contracts/critic.ts`, `packages/agents/src/contracts/memory.ts`, and `packages/agents/src/contracts/publisher.ts`
- [x] T014 [P] Implement Supabase client, repository base, and realtime helpers in `packages/db/src/client/supabase.ts`, `packages/db/src/repositories/base-repository.ts`, and `packages/db/src/realtime/events.ts`
- [x] T015 Create initial MVP database migration for `runs`, `agent_events`, `axl_messages`, `zero_g_refs`, `intels`, `signals`, `outbound_posts`, `analytics_snapshots`, `agent_nodes`, `app_config`, and `service_registry_snapshots` in `packages/db/migrations/001_mvp_schema.sql`
- [x] T016 [P] Create deterministic seed data and fixture packs for mocked signal runs, intel runs, scheduler state, and dashboard reads in `packages/db/src/seeds/demo-config.ts`, `packages/db/src/seeds/demo-runs.ts`, `packages/db/src/seeds/demo-analytics.ts`, `tests/fixtures/mock-signal-run.json`, and `tests/fixtures/mock-intel-run.json`
- [x] T017 Create backend bootstrap, environment parsing, logging, and graceful shutdown shell in `backend/src/bootstrap/runtime.ts`, `backend/src/bootstrap/env.ts`, `backend/src/bootstrap/logger.ts`, `backend/src/bootstrap/shutdown.ts`, and `backend/src/index.ts`
- [x] T018 [P] Implement scheduler shell, overlap guard, and runtime mode flags in `backend/src/scheduler/hourly-scheduler.ts`, `backend/src/scheduler/run-lock.ts`, and `backend/src/scheduler/runtime-mode.ts`
- [x] T019 [P] Implement AXL adapter interface and HTTP node client base in `packages/axl/src/adapter/axl-adapter.ts`, `packages/axl/src/node-client/http-node-client.ts`, `packages/axl/src/message-envelope/omen-message.ts`, and `packages/axl/src/peer-status/peer-status.ts`
- [x] T020 [P] Implement 0G adapter interface and storage/compute client base in `packages/zero-g/src/adapters/zero-g-adapter.ts`, `packages/zero-g/src/storage/storage-adapter.ts`, `packages/zero-g/src/storage/log-adapter.ts`, `packages/zero-g/src/compute/compute-adapter.ts`, and `packages/zero-g/src/chain/chain-adapter.ts`
- [x] T021 [P] Implement market-data adapter interfaces and service bases for Binance, CoinGecko, DeFiLlama, and Tavily-style research in `packages/market-data/src/types.ts`, `packages/market-data/src/binance/binance-adapter.ts`, `packages/market-data/src/coingecko/coingecko-adapter.ts`, `packages/market-data/src/defillama/defillama-adapter.ts`, and `packages/market-data/src/research/news-adapter.ts`
- [x] T022 [P] Implement X publishing contract and provider shell for the unofficial `twitterapi` path in `backend/src/services/x/twitterapi-client.ts`, `backend/src/services/x/post-formatter.ts`, `backend/src/services/x/rate-limit-store.ts`, and `packages/shared/src/schemas/x-post.ts`
- [x] T023 [P] Create frontend API client and query shells that replace local mocks with backend data sources in `frontend/src/lib/api/client.ts`, `frontend/src/lib/api/dashboard.ts`, `frontend/src/lib/api/intel.ts`, `frontend/src/lib/api/signals.ts`, `frontend/src/lib/api/analytics.ts`, and `frontend/src/lib/api/posts.ts`
- [x] T024 [P] Add foundational unit tests for schemas, adapters, and LangGraph state transitions in `packages/shared/tests/schemas.test.ts`, `packages/agents/tests/runtime-state.test.ts`, `packages/axl/tests/axl-adapter.test.ts`, `packages/zero-g/tests/zero-g-adapter.test.ts`, and `packages/market-data/tests/adapter-result.test.ts`
- [x] T081 [P] Define 0G namespace, manifest, and artifact-linking contracts for mutable KV state, immutable logs, file bundles, compute proofs, and optional chain anchors in `packages/shared/src/schemas/zero-g-manifest.ts`, `packages/zero-g/src/storage/namespace.ts`, and `packages/zero-g/src/proofs/proof-types.ts`
- [x] T082 [P] Define AXL-native service contracts for raw envelopes, MCP service routing, and A2A delegation payloads in `packages/shared/src/schemas/axl-mcp.ts`, `packages/shared/src/schemas/axl-a2a.ts`, `packages/axl/src/mcp/service-contract.ts`, and `packages/axl/src/a2a/delegation-contract.ts`
- [x] T083 [P] Implement 0G proof registry and optional anchor adapter shell for run-manifest commitments in `packages/zero-g/src/proofs/proof-registry.ts`, `packages/zero-g/src/chain/proof-anchor.ts`, and `packages/shared/src/schemas/chain-proof.ts`
- [x] T084 [P] Implement AXL topology and service-registry persistence primitives in `packages/db/src/repositories/service-registry-snapshots-repository.ts`, `packages/axl/src/topology/topology-snapshot.ts`, and `packages/axl/src/mcp/service-registry.ts`

**Checkpoint**: The monorepo has the exact technical foundation required for the MVP and nothing extra from the broader template surface is blocking execution.

---

## Phase 3: User Story 1 - Run the Hourly Swarm End-to-End (Priority: P1)

**Goal**: Ensure the backend executes the swarm automatically on the hourly schedule, coordinates multiple LangGraph agent roles across real AXL peers, writes canonical swarm state and proof bundles to 0G, and persists either one approved signal, one publishable intel item, or a transparent no-conviction outcome.

**Independent Validation**: Execute one deterministic mocked scheduled run and one hourly scheduled run, then confirm at least four specialist roles participate, at least three AXL exchanges are recorded through raw or MCP/A2A routes, 0G KV/log/file refs are written, one run manifest is assembled, and the run ends in a persisted signal, persisted intel, or explicit no-signal result.

### Validation for User Story 1

- [x] T025 [P] [US1] Add contract tests for scheduled run history and runtime status endpoints in `tests/integration/contracts/runtime-runs-api.contract.test.ts`
- [x] T026 [P] [US1] Add integration test for one deterministic signal-producing swarm run in `tests/integration/runtime/full-mocked-signal-run.test.ts`
- [x] T027 [P] [US1] Add integration test for one deterministic intel-producing swarm run in `tests/integration/runtime/full-mocked-intel-run.test.ts`
- [x] T028 [P] [US1] Add integration test for hourly scheduler triggering, no-overlap behavior, and idempotent scheduler-tick handling in `tests/integration/runtime/hourly-scheduler.test.ts`
- [ ] T085 [P] [US1] Add integration test for AXL MCP/A2A delegation across multiple local peers in `tests/integration/runtime/axl-mcp-a2a-delegation.test.ts`
- [ ] T086 [P] [US1] Add integration test for 0G manifest assembly and proof-link integrity in `tests/integration/runtime/zero-g-manifest-integrity.test.ts`

### Implementation for User Story 1

- [x] T029 [P] [US1] Implement run, config, and agent-node repositories in `packages/db/src/repositories/runs-repository.ts`, `packages/db/src/repositories/app-config-repository.ts`, and `packages/db/src/repositories/agent-nodes-repository.ts`
- [x] T030 [P] [US1] Implement agent-event, AXL-message, and 0G-ref repositories in `packages/db/src/repositories/agent-events-repository.ts`, `packages/db/src/repositories/axl-messages-repository.ts`, and `packages/db/src/repositories/zero-g-refs-repository.ts`
- [x] T031 [P] [US1] Implement market snapshot services for mids, candles, funding, movers, narratives, and macro context in `packages/market-data/src/binance/binance-market-service.ts`, `packages/market-data/src/coingecko/coingecko-market-service.ts`, `packages/market-data/src/defillama/defillama-market-service.ts`, and `packages/market-data/src/research/tavily-market-research-service.ts`
- [x] T032 [P] [US1] Implement explainable indicator primitives needed by the MVP analysis flow in `packages/indicators/src/basic/rsi.ts`, `packages/indicators/src/basic/macd.ts`, `packages/indicators/src/basic/moving-averages.ts`, `packages/indicators/src/basic/bollinger-bands.ts`, `packages/indicators/src/chart-analysis/support-resistance.ts`, and `packages/indicators/src/chart-analysis/multi-timeframe-alignment.ts`
- [x] T033 [P] [US1] Implement the scanner node with bias-first candidate selection and candidate caps in `packages/agents/src/definitions/scanner-agent.ts` and `packages/agents/src/definitions/market-bias-agent.ts`
- [x] T034 [P] [US1] Implement the research node for catalysts, narrative context, and source normalization in `packages/agents/src/definitions/research-agent.ts` and `packages/agents/src/prompts/research/system.ts`
- [x] T035 [P] [US1] Implement the analyst node for structured thesis generation in `packages/agents/src/definitions/analyst-agent.ts` and `packages/agents/src/prompts/analyst/system.ts`
- [x] T036 [P] [US1] Implement the critic node and hard quality-gate enforcement in `packages/agents/src/definitions/critic-agent.ts`, `packages/agents/src/quality-gates/quality-gates.ts`, and `packages/agents/src/quality-gates/critic-gate.ts`
- [x] T037 [P] [US1] Implement the memory node for checkpoint updates, evidence refs, and final report snapshots in `packages/agents/src/definitions/memory-agent.ts` and `packages/agents/src/prompts/memory/system.ts`
- [x] T038 [P] [US1] Implement the publisher-prep node that formats public signal alerts, intel summaries, and dashboard-friendly copy in `packages/agents/src/definitions/publisher-agent.ts` and `packages/agents/src/prompts/publisher/system.ts`
- [x] T039 [US1] Assemble the LangGraph supervisor workflow and checkpoint integration in `packages/agents/src/framework/omen-swarm-graph.ts` and `packages/agents/src/framework/graph-factory.ts`
- [x] T040 [US1] Implement the backend run coordinator and scheduler-driven demo pipeline in `backend/src/coordinator/run-coordinator.ts`, `backend/src/pipelines/demo-run-pipeline.ts`, and `backend/src/scheduler/scheduler-tick.ts`
- [x] T041 [US1] Implement the hourly scheduler worker, overlap lock, and interval-driven execution loop in `backend/src/scheduler/hourly-scheduler.ts`, `backend/src/scheduler/run-lock.ts`, and `backend/src/workers/runtime-worker.ts`
- [x] T042 [US1] Implement AXL-backed logical node registration and message send/receive orchestration for scanner, research, analyst, critic, and orchestrator roles in `backend/src/nodes/axl-node-manager.ts`, `backend/src/nodes/axl-peer-registry.ts`, and `packages/axl/src/adapter/axl-http-adapter.ts`
- [x] T043 [US1] Implement 0G KV state writes, append-only log writes, and one compute-backed report/reflection example path in `packages/zero-g/src/storage/zero-g-state-store.ts`, `packages/zero-g/src/storage/zero-g-log-store.ts`, `packages/zero-g/src/compute/zero-g-report-synthesis.ts`, and `backend/src/publishers/zero-g-publisher.ts`
- [x] T044 [US1] Persist runtime events, node status, AXL receipts, and 0G refs during execution in `backend/src/publishers/event-publisher.ts`, `backend/src/publishers/axl-message-recorder.ts`, and `backend/src/publishers/zero-g-ref-recorder.ts`
- [x] T045 [US1] Implement read-only run history, runtime status, and logs APIs in `backend/src/api/runs.controller.ts`, `backend/src/api/status.controller.ts`, `backend/src/api/logs.controller.ts`, and `backend/src/api/routes.ts`
- [ ] T087 [P] [US1] Implement AXL-hosted MCP services for scanner, research, analyst, and critic capabilities in `backend/src/nodes/services/scanner-mcp.ts`, `backend/src/nodes/services/research-mcp.ts`, `backend/src/nodes/services/analyst-mcp.ts`, and `backend/src/nodes/services/critic-mcp.ts`
- [ ] T088 [P] [US1] Implement A2A delegation client and response handling for orchestrator-to-specialist workflows in `packages/axl/src/a2a/a2a-client.ts`, `backend/src/nodes/a2a/orchestrator-delegator.ts`, and `backend/src/nodes/a2a/response-correlator.ts`
- [ ] T089 [US1] Implement topology-aware peer discovery, service registration, and rerouting logic in `backend/src/nodes/topology/topology-poller.ts`, `backend/src/nodes/topology/service-registry-sync.ts`, and `backend/src/nodes/topology/peer-failover.ts`
- [ ] T090 [US1] Implement 0G-backed run manifest assembly that links KV checkpoints, debate logs, evidence files, compute results, and final published artifacts in `packages/zero-g/src/proofs/run-manifest-builder.ts`, `backend/src/publishers/run-manifest-publisher.ts`, and `packages/shared/src/schemas/zero-g-manifest.ts`
- [ ] T091 [US1] Persist chart renders, evidence packs, and final report bundles as 0G files in `packages/zero-g/src/storage/zero-g-file-store.ts`, `backend/src/publishers/evidence-bundle-publisher.ts`, and `backend/src/publishers/report-bundle-publisher.ts`
- [ ] T092 [US1] Strengthen 0G Compute usage by moving final adjudication or report synthesis onto a verifiable compute-backed path and recording provider/proof metadata in `packages/zero-g/src/compute/zero-g-adjudication.ts`, `backend/src/publishers/compute-proof-recorder.ts`, and `packages/shared/src/schemas/compute-proof.ts`

**Checkpoint**: The backend can execute the MVP swarm automatically on the hourly schedule, with LangGraph, AXL, and 0G visibly participating in the run.

---

## Phase 4: User Story 2 - Show Real Intel, Signals, Logs, and Analytics in the Dashboard (Priority: P1)

**Goal**: Replace the current mock-backed dashboard experience with live data so the existing Omen UI surfaces real swarm output, recent logs, scheduler state, signal history, intel history, analytics summaries, AXL network state, and 0G proof artifacts.

**Independent Validation**: Load the dashboard after seeded runs exist and confirm the home page, intel feed/detail, signals page, terminal log panel, and analytics tabs all render backend-backed data without reading local mock files.

### Validation for User Story 2

- [ ] T046 [P] [US2] Add contract tests for dashboard summary, intel, signals, analytics, and logs endpoints in `tests/integration/contracts/dashboard-mvp-api.contract.test.ts`
- [ ] T047 [P] [US2] Add integration test for run-to-read-model projection into dashboard, intel, signal, and analytics responses in `tests/integration/runtime/dashboard-read-models.test.ts`
- [ ] T048 [P] [US2] Add Playwright smoke coverage for dashboard home, intel feed/detail, signals page, analytics tabs, and sponsor proof panels in `tests/e2e/dashboard-mvp-smoke.spec.ts`

### Implementation for User Story 2

- [ ] T049 [P] [US2] Implement intel, signal, analytics, and outbound-post repositories in `packages/db/src/repositories/intels-repository.ts`, `packages/db/src/repositories/signals-repository.ts`, `packages/db/src/repositories/analytics-snapshots-repository.ts`, and `packages/db/src/repositories/outbound-posts-repository.ts`
- [ ] T050 [P] [US2] Implement response presenters and view-model mappers for dashboard, intel, signals, logs, and analytics in `backend/src/presenters/dashboard.presenter.ts`, `backend/src/presenters/intel.presenter.ts`, `backend/src/presenters/signals.presenter.ts`, `backend/src/presenters/logs.presenter.ts`, and `backend/src/presenters/analytics.presenter.ts`
- [ ] T051 [P] [US2] Implement dashboard summary aggregation for latest signal, latest intel, system status, next run countdown, and mindshare data in `backend/src/read-models/dashboard-summary.ts` and `backend/src/read-models/runtime-status.ts`
- [ ] T052 [P] [US2] Implement analytics snapshot projection for activity, confidence bands, token frequency, win-rate, and mindshare summaries in `backend/src/read-models/analytics-snapshots.ts` and `backend/src/read-models/token-frequency.ts`
- [ ] T053 [P] [US2] Implement dashboard, intel, signals, analytics, logs, topology, and proofs APIs in `backend/src/api/dashboard.controller.ts`, `backend/src/api/intel.controller.ts`, `backend/src/api/signals.controller.ts`, `backend/src/api/analytics.controller.ts`, `backend/src/api/logs.controller.ts`, `backend/src/api/topology.controller.ts`, `backend/src/api/proofs.controller.ts`, and `backend/src/api/routes.ts`
- [ ] T054 [P] [US2] Replace `frontend/src/data/mockData.ts` usage with seeded fallback adapters and live query functions in `frontend/src/lib/api/dashboard.ts`, `frontend/src/lib/api/intel.ts`, `frontend/src/lib/api/signals.ts`, `frontend/src/lib/api/analytics.ts`, and `frontend/src/lib/api/logs.ts`
- [ ] T055 [P] [US2] Implement frontend hooks for run status, signals, intel, logs, and analytics in `frontend/src/hooks/useRunStatus.ts`, `frontend/src/hooks/useSignals.ts`, `frontend/src/hooks/useIntel.ts`, `frontend/src/hooks/useLogs.ts`, and `frontend/src/hooks/useAnalytics.ts`
- [ ] T056 [US2] Wire `frontend/src/pages/DashboardHome.tsx`, `frontend/src/components/SignalCard.tsx`, `frontend/src/components/IntelCard.tsx`, and `frontend/src/components/TerminalLog.tsx` to live dashboard data and run status responses
- [ ] T057 [US2] Wire `frontend/src/pages/SignalsPage.tsx` and `frontend/src/components/ui/SearchAndSort.tsx` to real signal history, filter, sort, and pagination responses
- [ ] T058 [US2] Wire `frontend/src/pages/IntelPage.tsx`, `frontend/src/components/IntelBlog.tsx`, and `frontend/src/components/IntelThread.tsx` to live intel feed and detail responses
- [ ] T059 [US2] Wire `frontend/src/pages/AnalyticsPage.tsx`, `frontend/src/pages/analytics/AnalyticsOverview.tsx`, `frontend/src/pages/analytics/SignalAnalytics.tsx`, `frontend/src/pages/analytics/MarketAnalytics.tsx`, and `frontend/src/pages/analytics/PerformanceAnalytics.tsx` to live analytics snapshots
- [ ] T060 [US2] Surface next scheduled run, runtime mode, and latest posting state in `frontend/src/pages/DashboardHome.tsx` and `frontend/src/components/layout/DashboardLayout.tsx`
- [ ] T093 [P] [US2] Build dashboard sponsor panels for AXL peer graph, service registry, and route history in `frontend/src/components/network/PeerTopologyPanel.tsx`, `frontend/src/components/network/ServiceRegistryPanel.tsx`, and `frontend/src/components/network/RouteTimeline.tsx`
- [ ] T094 [P] [US2] Build 0G proof surfaces for run manifests, artifact refs, compute verification, and optional chain anchors in `frontend/src/components/proofs/RunManifestPanel.tsx`, `frontend/src/components/proofs/ArtifactList.tsx`, `frontend/src/components/proofs/ComputeProofCard.tsx`, and `frontend/src/components/proofs/ChainAnchorCard.tsx`
- [ ] T095 [US2] Surface sponsor proof data in `frontend/src/pages/DashboardHome.tsx`, `frontend/src/pages/SignalsPage.tsx`, and `frontend/src/pages/IntelPage.tsx` without adding a new non-essential page
- [ ] T096 [US2] Implement frontend hooks for topology and proof data in `frontend/src/hooks/useTopology.ts` and `frontend/src/hooks/useProofs.ts`

**Checkpoint**: The current Omen UI stops being a static shell and becomes a real read layer over the swarm runtime.

---

## Phase 5: User Story 3 - Publish Approved Output to X Through the MVP Delivery Path (Priority: P1)

**Goal**: Queue and publish approved signal alerts and intel summaries to X through the chosen unofficial `twitterapi` provider, record delivery outcomes, write the public payload and result refs back into the 0G proof bundle, and show posting status back in the dashboard.

**Independent Validation**: Complete one signal run and one intel run, then verify each creates an outbound post record, formats a valid public payload, successfully posts through the mocked or real `twitterapi` client, and exposes posting status in the UI.

### Validation for User Story 3

- [ ] T061 [P] [US3] Add contract tests for outbound-post status endpoints and dashboard posting fields in `tests/integration/contracts/outbound-posts-api.contract.test.ts`
- [ ] T062 [P] [US3] Add integration test for signal publication from run completion to outbound post completion in `tests/integration/runtime/signal-publication.test.ts`
- [ ] T063 [P] [US3] Add integration test for intel publication, retry handling, and provider failure fallbacks in `tests/integration/runtime/intel-publication.test.ts`

### Implementation for User Story 3

- [ ] T064 [P] [US3] Implement outbound-post lifecycle schemas, repository methods, and delivery-state transitions in `packages/shared/src/schemas/post.ts`, `packages/db/src/repositories/outbound-posts-repository.ts`, and `backend/src/services/x/post-state-machine.ts`
- [ ] T065 [P] [US3] Implement the unofficial `twitterapi` client, auth/env parsing, and provider-specific error normalization in `backend/src/services/x/twitterapi-client.ts`, `backend/src/bootstrap/env.ts`, and `backend/src/services/x/twitterapi-errors.ts`
- [ ] T066 [P] [US3] Implement post formatting for signal alerts, intel summaries, and optional intel threads in `backend/src/services/x/post-formatter.ts`, `backend/src/services/x/intel-thread-builder.ts`, and `packages/shared/src/schemas/x-post.ts`
- [ ] T067 [P] [US3] Implement the outbound post queue worker, retry policy, and rate-limit tracking in `backend/src/services/x/post-queue.ts`, `backend/src/services/x/post-worker.ts`, and `backend/src/services/x/rate-limit-store.ts`
- [ ] T068 [US3] Connect the publisher node and run coordinator to outbound post creation for approved signals and publishable intel in `packages/agents/src/definitions/publisher-agent.ts`, `backend/src/coordinator/run-coordinator.ts`, and `backend/src/publishers/post-publisher.ts`
- [ ] T069 [US3] Persist post results back into run records and analytics projections in `backend/src/publishers/post-result-recorder.ts`, `backend/src/read-models/dashboard-summary.ts`, and `backend/src/read-models/analytics-snapshots.ts`
- [ ] T070 [US3] Implement outbound post query APIs in `backend/src/api/posts.controller.ts`, `backend/src/api/dashboard.controller.ts`, and `backend/src/api/routes.ts`
- [ ] T071 [US3] Surface posting status, published URLs, and failed delivery states in `frontend/src/pages/DashboardHome.tsx`, `frontend/src/pages/IntelPage.tsx`, `frontend/src/pages/SignalsPage.tsx`, and `frontend/src/components/TerminalLog.tsx`
- [ ] T097 [US3] Append final X post payloads, provider responses, and published URLs into the 0G run manifest and artifact set in `backend/src/publishers/post-proof-publisher.ts`, `packages/zero-g/src/proofs/run-manifest-builder.ts`, and `packages/shared/src/schemas/post-proof.ts`
- [ ] T098 [US3] Surface public post proof refs alongside delivery status in `frontend/src/components/proofs/ArtifactList.tsx`, `frontend/src/pages/SignalsPage.tsx`, and `frontend/src/pages/IntelPage.tsx`

**Checkpoint**: The MVP can complete a swarm run and push its public-facing output all the way to X using the new delivery path.

---

## Phase 6: MVP Hardening & Demo Readiness

**Purpose**: Prove the MVP is demoable, testable, and sponsor-aligned without pulling in non-MVP template subsystems.

- [ ] T072 [P] Add AXL real-path smoke coverage with clearly flagged fallback fixtures in `tests/integration/runtime/axl-smoke.test.ts`
- [ ] T073 [P] Add 0G real-path smoke coverage with clearly flagged fallback fixtures in `tests/integration/runtime/zero-g-smoke.test.ts`
- [ ] T074 [P] Add schema drift checks for `specs/001-omen-swarm-runtime/contracts/control-plane.openapi.yaml` and `packages/shared/src/schemas/*.ts` in `tests/integration/contracts/schema-drift.test.ts`
- [ ] T075 Update `specs/001-omen-swarm-runtime/quickstart.md` with the exact local startup order for frontend, backend, scheduler, AXL nodes, and seeded demo mode
- [ ] T076 Write MVP architecture, setup, environment, hourly scan, 0G usage, AXL usage, and X posting docs in `README.md`
- [ ] T077 Write the exact three-minute judge walkthrough in `DEMO.md`
- [ ] T078 Add local AXL node and mocked runtime helper scripts in `scripts/axl/start-orchestrator-node.ps1`, `scripts/axl/start-scanner-node.ps1`, `scripts/axl/start-research-node.ps1`, `scripts/axl/start-analyst-node.ps1`, `scripts/axl/start-critic-node.ps1`, and `scripts/runtime/start-mocked-hourly-run.ps1`
- [ ] T079 [P] Perform copy audit for Omen-only branding in `frontend/src`, `backend/src`, `packages`, `README.md`, and `DEMO.md`
- [ ] T080 Run full workspace lint, typecheck, and test commands and record the verified MVP command set in `README.md`
- [ ] T099 [P] Add dedicated AXL MCP/A2A smoke tests with peer failure and rerouting coverage in `tests/integration/runtime/axl-mcp-smoke.test.ts` and `tests/integration/runtime/axl-peer-failover-smoke.test.ts`
- [ ] T100 [P] Add dedicated 0G Compute proof-path smoke coverage in `tests/integration/runtime/zero-g-compute-smoke.test.ts`
- [ ] T101 Update `README.md`, `DEMO.md`, and `specs/001-omen-swarm-runtime/quickstart.md` to explicitly present the sponsor thesis: AXL for decentralized coordination and 0G for canonical memory, proof bundles, and verifiable compute

---

## Deferred Until After MVP

These items are intentionally out of scope until the MVP above is complete:

- Wallet tiers, gated feeds, Telegram delivery, and tier snapshots from the template flow
- Hyperliquid execution, futures agents, signal job queues, position monitoring, and PnL sync
- Yield farming, airdrops, prediction markets, custom scans, chat, and voice tooling
- Premium deep dives, premium-only docs surfaces, and long-form exclusives beyond the base intel feed
- Full trace explorer, deep audit UI, and post-trade reflection surfaces beyond what is needed for sponsor proof and dashboard credibility
- Extra marketing/docs pages that do not help the MVP demo path
- Advanced 0G chain contract workflows beyond optional manifest anchoring
- General-purpose AXL experimentation that is not part of the swarm runtime, MCP routing, or A2A delegation path

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup** has no dependencies and starts immediately.
- **Phase 2: MVP Foundation** depends on Setup and blocks all user stories.
- **Phase 3: US1** depends on Foundation and is the first hard delivery gate.
- **Phase 4: US2** depends on US1 producing stable run, intel, signal, and event data.
- **Phase 5: US3** depends on US1 for publisher-ready payloads and on US2 for posting-state display.
- **Phase 6: Hardening** depends on all MVP stories being complete.

### User Story Dependencies

- **US1 (P1)**: Builds the real runtime spine and must land first. It also establishes the strongest sponsor-specific proof points.
- **US2 (P1)**: Depends on US1 output tables and read models but can start once run persistence contracts are stable.
- **US3 (P1)**: Depends on US1 publication payloads and benefits from US2 dashboard surfaces for visibility.

### Within Each User Story

- Validation tasks should be written before story implementation is considered done.
- Shared repositories and schemas come before backend services and API routes.
- Backend runtime and read-model logic come before frontend integration.
- Existing UI files should be wired to live data before any new dashboard surface is created.

### Parallel Opportunities

- Foundation tasks marked `[P]` can run in parallel after the monorepo shell is stable.
- Within US1, market-data adapters, LangGraph node definitions, AXL peer services, and 0G proof builders can be split across contributors.
- Within US2, backend presenters/APIs and frontend hook wiring can be split after read-model contracts exist.
- Within US3, the provider client, formatter, and dashboard status surfaces can be split once the outbound-post schema is final.

---

## Parallel Example: User Story 1

```bash
# Validation
Task: "Add integration test for one deterministic signal-producing swarm run in tests/integration/runtime/full-mocked-signal-run.test.ts"
Task: "Add integration test for one deterministic intel-producing swarm run in tests/integration/runtime/full-mocked-intel-run.test.ts"
Task: "Add integration test for hourly scheduler triggering, no-overlap behavior, and idempotent start handling in tests/integration/runtime/hourly-scheduler.test.ts"

# Implementation
Task: "Implement the scanner node with bias-first candidate selection and candidate caps in packages/agents/src/definitions/scanner-agent.ts and packages/agents/src/definitions/market-bias-agent.ts"
Task: "Implement the analyst and critic nodes in packages/agents/src/definitions/analyst-agent.ts and packages/agents/src/definitions/critic-agent.ts"
Task: "Implement AXL-backed logical node registration and message orchestration in backend/src/nodes/axl-node-manager.ts and packages/axl/src/adapter/axl-http-adapter.ts"
Task: "Implement AXL-hosted MCP services and A2A delegation in backend/src/nodes/services/*.ts and packages/axl/src/a2a/a2a-client.ts"
Task: "Implement 0G-backed run manifest assembly in packages/zero-g/src/proofs/run-manifest-builder.ts and backend/src/publishers/run-manifest-publisher.ts"
```

---

## Parallel Example: User Story 2

```bash
# Validation
Task: "Add contract tests for dashboard summary, intel, signals, analytics, and logs endpoints in tests/integration/contracts/dashboard-mvp-api.contract.test.ts"
Task: "Add Playwright smoke coverage for dashboard home, intel feed/detail, signals page, and analytics tabs in tests/e2e/dashboard-mvp-smoke.spec.ts"

# Implementation
Task: "Implement dashboard summary aggregation in backend/src/read-models/dashboard-summary.ts and backend/src/api/dashboard.controller.ts"
Task: "Wire frontend/src/pages/SignalsPage.tsx and frontend/src/components/ui/SearchAndSort.tsx to real signal history responses"
Task: "Wire frontend/src/pages/IntelPage.tsx and frontend/src/components/IntelBlog.tsx to live intel feed and detail responses"
Task: "Build dashboard sponsor panels in frontend/src/components/network/*.tsx and frontend/src/components/proofs/*.tsx"
```

---

## Parallel Example: User Story 3

```bash
# Validation
Task: "Add integration test for signal publication from run completion to outbound post completion in tests/integration/runtime/signal-publication.test.ts"
Task: "Add integration test for intel publication, retry handling, and provider failure fallbacks in tests/integration/runtime/intel-publication.test.ts"

# Implementation
Task: "Implement the unofficial twitterapi client and provider-specific error normalization in backend/src/services/x/twitterapi-client.ts and backend/src/services/x/twitterapi-errors.ts"
Task: "Implement the outbound post queue worker in backend/src/services/x/post-queue.ts and backend/src/services/x/post-worker.ts"
Task: "Surface posting status, published URLs, and failed delivery states in frontend/src/pages/DashboardHome.tsx and frontend/src/pages/SignalsPage.tsx"
Task: "Append final X post payloads and results into the 0G run manifest in backend/src/publishers/post-proof-publisher.ts"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1: Setup.
2. Complete Phase 2: MVP Foundation.
3. Complete Phase 3: Hourly swarm execution and sponsor proof path.
4. Complete Phase 4: Replace frontend mocks with live dashboard data.
5. Complete Phase 5: Ship public X posting through the new provider.
6. Complete Phase 6: Harden the MVP and freeze the demo script.

### Delivery Rule

1. Do not start wallet tiers, Telegram distribution, Hyperliquid execution, or other template subsystems before the MVP phases above are done.
2. Prefer wiring the existing Omen UI files to real data over creating new surfaces.
3. Keep the backend as the only long-running runtime and scheduler host.
4. Treat 0G and AXL as core product infrastructure, not just sponsor badges or logging sinks.

### Parallel Team Strategy

With multiple contributors:

1. One contributor owns shared schemas, DB migrations, and repositories.
2. One contributor owns LangGraph orchestration and scheduler flow.
3. One contributor owns AXL peer services, MCP/A2A routing, and failover.
4. One contributor owns 0G state, artifact, manifest, and compute-proof integration.
5. One contributor owns dashboard read models, APIs, and frontend hook wiring.
6. One contributor owns X posting, smoke tests, and demo documentation.

---

## Notes

- `[P]` tasks touch distinct files or can proceed after their prerequisites are complete.
- User story labels map directly to the MVP delivery slices in this document.
- Every in-scope MVP story includes explicit validation tasks.
- The MVP includes only hourly swarm execution, dashboard data, sponsor proof paths, and public X posting.
- The sponsor thesis for judging is explicit: AXL handles decentralized coordination, while 0G handles canonical memory, proof bundles, and one verifiable compute-backed reasoning path.
- Avoid mixing long-running runtime logic into frontend code paths.
- Keep `main` as the working branch for this repository workflow.
