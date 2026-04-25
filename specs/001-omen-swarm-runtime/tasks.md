# Tasks: Omen Autonomous Market-Intelligence Swarm

**Input**: Design documents from `/specs/001-omen-swarm-runtime/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`

**Validation**: Every user story includes automated validation tasks because the feature specification explicitly requires unit tests, integration tests, and a deterministic demo walkthrough.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently after foundational work is complete.

## Format: `[ID] [P?] [Story] Description`

- `[P]` marks tasks that can run in parallel when their dependencies are already satisfied.
- `[Story]` appears only on user-story tasks and maps to `US1` through `US4`.
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

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core architecture and infrastructure that must exist before any user story implementation.

**Critical**: No user story work should start until this phase is complete.

- [ ] T009 Create shared schema barrel and primitives in `packages/shared/src/schemas/index.ts`, `packages/shared/src/types/index.ts`, `packages/shared/src/constants/index.ts`, and `packages/shared/src/utils/result.ts`
- [ ] T010 [P] Implement core domain schemas for runs, events, signals, refs, config, and envelopes in `packages/shared/src/schemas/run.ts`, `packages/shared/src/schemas/event.ts`, `packages/shared/src/schemas/signal.ts`, `packages/shared/src/schemas/zero-g.ts`, `packages/shared/src/schemas/config.ts`, and `packages/shared/src/schemas/axl.ts`
- [ ] T011 [P] Implement LangGraph runtime interfaces in `packages/agents/src/framework/agent-runtime.ts`, `packages/agents/src/framework/state.ts`, and `packages/agents/src/framework/checkpointing.ts`
- [ ] T012 [P] Implement Supabase client and repository base in `packages/db/src/client/supabase.ts`, `packages/db/src/repositories/base-repository.ts`, and `packages/db/src/realtime/events.ts`
- [ ] T013 Create initial database migrations for `runs`, `agent_events`, `axl_messages`, `zero_g_refs`, `signals`, `signal_evidence`, `signal_status_updates`, `agent_nodes`, `app_config`, and `paper_positions` in `packages/db/migrations/001_initial_schema.sql`
- [ ] T014 [P] Create deterministic seed data for mocked demo mode in `packages/db/src/seeds/demo-config.ts`, `packages/db/src/seeds/demo-runs.ts`, and `tests/fixtures/mock-demo-run.json`
- [ ] T015 [P] Implement runtime command trigger contract in `packages/shared/src/schemas/commands.ts`, `packages/db/src/repositories/runtime-commands-repository.ts`, `backend/src/api/runs.controller.ts`, and `backend/src/api/routes.ts`
- [ ] T016 [P] Implement AXL adapter interface and HTTP node client base in `packages/axl/src/adapter/axl-adapter.ts`, `packages/axl/src/node-client/http-node-client.ts`, `packages/axl/src/message-envelope/omen-message.ts`, and `packages/axl/src/peer-status/peer-status.ts`
- [ ] T017 [P] Implement 0G adapter interface and storage/compute client base in `packages/zero-g/src/adapters/zero-g-adapter.ts`, `packages/zero-g/src/storage/storage-adapter.ts`, `packages/zero-g/src/compute/compute-adapter.ts`, and `packages/zero-g/src/chain/chain-adapter.ts`
- [ ] T018 [P] Implement market-data adapter interfaces in `packages/market-data/src/types.ts`, `packages/market-data/src/hyperliquid/hyperliquid-adapter.ts`, `packages/market-data/src/binance/binance-adapter.ts`, `packages/market-data/src/coingecko/coingecko-adapter.ts`, and `packages/market-data/src/defillama/defillama-adapter.ts`
- [ ] T019 [P] Implement indicator library foundation in `packages/indicators/src/basic/rsi.ts`, `packages/indicators/src/basic/macd.ts`, `packages/indicators/src/basic/moving-averages.ts`, `packages/indicators/src/basic/bollinger-bands.ts`, and `packages/indicators/src/chart-analysis/support-resistance.ts`
- [ ] T020 [P] Implement paper execution primitives in `packages/execution/src/paper/paper-position.ts`, `packages/execution/src/paper/paper-execution-service.ts`, and `packages/execution/src/safeguards/execution-guards.ts`
- [ ] T021 Create backend bootstrap, logging, and graceful shutdown shell in `backend/src/bootstrap/runtime.ts`, `backend/src/bootstrap/env.ts`, `backend/src/bootstrap/logger.ts`, and `backend/src/index.ts`
- [ ] T022 Create frontend shell and dark design system foundation in `frontend/src/App.tsx`, `frontend/src/index.css`, `frontend/src/components/layout/AppShell.tsx`, and `frontend/src/components/ui/StatusBadge.tsx`
- [ ] T023 [P] Add foundational unit tests for shared schemas and adapter interfaces in `packages/shared/tests/schemas.test.ts`, `packages/axl/tests/axl-adapter.test.ts`, `packages/zero-g/tests/zero-g-adapter.test.ts`, and `packages/market-data/tests/adapter-result.test.ts`

**Checkpoint**: Foundation is ready. User stories can now be implemented in parallel.

---

## Phase 3: User Story 1 - Launch a Transparent Demo Run (Priority: P1)

**Goal**: Allow an operator to start a demo run and watch a separate backend/runtime coordinate multiple agents, exchange AXL messages, persist 0G state/log refs, and publish a final report or no-conviction outcome.

**Independent Validation**: From the dashboard, trigger a mocked demo run and verify the backend/runtime starts separately, at least four specialist agents participate, at least three AXL exchanges are recorded, 0G refs are written, and one final report or transparent no-signal result appears.

### Validation for User Story 1

- [ ] T024 [P] [US1] Add contract tests for control-plane run endpoints in `tests/integration/contracts/runs-api.contract.test.ts`
- [ ] T025 [P] [US1] Add integration test for one deterministic full swarm run in `tests/integration/runtime/full-mocked-run.test.ts`
- [ ] T026 [P] [US1] Add integration test for runtime command trigger and idempotent run start in `tests/integration/runtime/start-demo-command.test.ts`

### Implementation for User Story 1

- [ ] T027 [P] [US1] Implement run, candidate, and config repositories in `packages/db/src/repositories/runs-repository.ts`, `packages/db/src/repositories/signal-candidates-repository.ts`, and `packages/db/src/repositories/app-config-repository.ts`
- [ ] T028 [P] [US1] Implement Hyperliquid and Binance market reads for mids, candles, and funding in `packages/market-data/src/hyperliquid/hyperliquid-market-service.ts` and `packages/market-data/src/binance/binance-futures-service.ts`
- [ ] T029 [P] [US1] Implement market-bias and scanner graph nodes in `packages/agents/src/definitions/market-bias-agent.ts` and `packages/agents/src/definitions/scanner-agent.ts`
- [ ] T030 [P] [US1] Implement research, chart/vision, analyst, and critic graph nodes in `packages/agents/src/definitions/research-agent.ts`, `packages/agents/src/definitions/chart-vision-agent.ts`, `packages/agents/src/definitions/analyst-agent.ts`, and `packages/agents/src/definitions/critic-agent.ts`
- [ ] T031 [P] [US1] Implement memory and publisher graph nodes in `packages/agents/src/definitions/memory-agent.ts` and `packages/agents/src/definitions/publisher-agent.ts`
- [ ] T032 [US1] Implement quality-gate evaluation in `packages/agents/src/quality-gates/quality-gates.ts` and `packages/agents/src/quality-gates/critic-gate.ts`
- [ ] T033 [US1] Implement LangGraph supervisor workflow and checkpointer integration in `packages/agents/src/framework/omen-swarm-graph.ts` and `packages/agents/src/framework/graph-factory.ts`
- [ ] T034 [US1] Implement backend command loop and run coordinator in `backend/src/commands/command-poller.ts`, `backend/src/coordinator/run-coordinator.ts`, and `backend/src/pipelines/demo-run-pipeline.ts`
- [ ] T035 [US1] Implement AXL-backed node registration and message send/receive orchestration in `backend/src/nodes/axl-node-manager.ts` and `packages/axl/src/adapter/axl-http-adapter.ts`
- [ ] T036 [US1] Implement 0G mutable state writes and log appends in `packages/zero-g/src/storage/zero-g-state-store.ts`, `packages/zero-g/src/storage/zero-g-log-store.ts`, and `backend/src/publishers/zero-g-publisher.ts`
- [ ] T037 [US1] Implement runtime event emission to Supabase in `backend/src/publishers/event-publisher.ts` and `packages/db/src/repositories/agent-events-repository.ts`
- [ ] T038 [US1] Implement `POST /api/runs/start-demo` and `GET /api/runs` in `backend/src/api/runs.controller.ts`, `backend/src/api/routes.ts`, and `frontend/src/lib/api/runs.ts`
- [ ] T039 [US1] Implement `GET /api/runs/[id]` and `GET /api/agents/status` in `backend/src/api/runs.controller.ts`, `backend/src/api/agents.controller.ts`, and `backend/src/api/routes.ts`
- [ ] T040 [US1] Build Mission Control page in `frontend/src/pages/MissionControl.tsx`, `frontend/src/components/mission-control/RunLaunchForm.tsx`, `frontend/src/components/mission-control/RunStatusPanel.tsx`, and `frontend/src/components/mission-control/AgentStatusGrid.tsx`
- [ ] T041 [US1] Build landing page sponsor-positioning sections in `frontend/src/pages/Home.tsx`, `frontend/src/components/marketing/Hero.tsx`, and `frontend/src/components/marketing/IntegrationStrip.tsx`
- [ ] T042 [US1] Add realtime run-status hooks for Mission Control in `frontend/src/lib/realtime/subscribeRun.ts` and `frontend/src/hooks/useRunStatus.ts`

**Checkpoint**: User Story 1 delivers a complete MVP demo run with separate runtime execution and visible live status.

---

## Phase 4: User Story 2 - Audit Why a Signal Was Approved or Rejected (Priority: P2)

**Goal**: Let a judge or operator inspect the complete chronological trace, AXL exchanges, 0G references, evidence pack, analyst thesis, critic objections, and final report.

**Independent Validation**: Open a completed run and signal detail page and confirm that chronological events, filters, AXL messages, evidence, analyst output, critic objections, and 0G references are all visible without reading backend logs.

### Validation for User Story 2

- [ ] T043 [P] [US2] Add contract tests for trace, signal, and 0G-ref endpoints in `tests/integration/contracts/trace-and-signals-api.contract.test.ts`
- [ ] T044 [P] [US2] Add integration test for trace creation and retrieval in `tests/integration/runtime/trace-persistence.test.ts`
- [ ] T045 [P] [US2] Add Playwright audit-flow test for trace and signal detail pages in `tests/e2e/audit-trace-and-signal-detail.spec.ts`

### Implementation for User Story 2

- [ ] T046 [P] [US2] Implement message, ref, evidence, and signal repositories in `packages/db/src/repositories/axl-messages-repository.ts`, `packages/db/src/repositories/zero-g-refs-repository.ts`, `packages/db/src/repositories/signal-evidence-repository.ts`, and `packages/db/src/repositories/signals-repository.ts`
- [ ] T047 [P] [US2] Implement event-to-trace projection and filtering helpers in `packages/shared/src/utils/trace-filtering.ts` and `frontend/src/lib/trace/tracePresenter.ts`
- [ ] T048 [P] [US2] Implement `GET /api/runs/[id]/trace`, `GET /api/signals`, and `GET /api/signals/[id]` in `backend/src/api/trace.controller.ts`, `backend/src/api/signals.controller.ts`, and `backend/src/api/routes.ts`
- [ ] T049 [P] [US2] Implement `GET /api/axl/peers` and `GET /api/0g/refs/[runId]` in `backend/src/api/axl.controller.ts`, `backend/src/api/zero-g.controller.ts`, and `backend/src/api/routes.ts`
- [ ] T050 [US2] Persist important AXL receipts and 0G refs during runtime execution in `backend/src/publishers/axl-message-recorder.ts` and `backend/src/publishers/zero-g-ref-recorder.ts`
- [ ] T051 [US2] Build Agent Trace page and filters in `frontend/src/pages/AgentTrace.tsx`, `frontend/src/components/trace/TraceTimeline.tsx`, `frontend/src/components/trace/TraceFilters.tsx`, and `frontend/src/components/trace/AxlMessageCard.tsx`
- [ ] T052 [US2] Build Signals list page in `frontend/src/pages/Signals.tsx`, `frontend/src/components/signals/SignalsTable.tsx`, and `frontend/src/components/signals/SignalStatusChip.tsx`
- [ ] T053 [US2] Build Signal Detail page in `frontend/src/pages/SignalDetail.tsx`, `frontend/src/components/signals/SignalThesisPanel.tsx`, `frontend/src/components/signals/EvidencePack.tsx`, `frontend/src/components/signals/CriticReviewPanel.tsx`, and `frontend/src/components/signals/ProofReferences.tsx`
- [ ] T054 [US2] Add realtime trace and signal hooks in `frontend/src/hooks/useRunTrace.ts`, `frontend/src/hooks/useSignals.ts`, and `frontend/src/hooks/useSignalDetail.ts`

**Checkpoint**: User Story 2 adds full auditability and post-run inspection without depending on US3 or US4.

---

## Phase 5: User Story 3 - Operate the Swarm Safely in Demo Mode (Priority: P3)

**Goal**: Keep Omen safe and resilient by default through paper/testnet execution, degraded-mode handling, explicit uncertainty reporting, and post-signal monitoring.

**Independent Validation**: Run the system in mocked or live-read mode with one optional provider disabled and verify that the swarm still completes, outputs uncertainty/missing-data notes, creates paper positions only, and records monitor/reflection updates.

### Validation for User Story 3

- [ ] T055 [P] [US3] Add unit tests for indicators and quality gates in `packages/indicators/tests/basic-indicators.test.ts` and `packages/agents/tests/quality-gates.test.ts`
- [ ] T056 [P] [US3] Add unit tests for critic logic and paper execution calculations in `packages/agents/tests/critic-agent.test.ts` and `packages/execution/tests/paper-execution.test.ts`
- [ ] T057 [P] [US3] Add integration test for paper-position lifecycle and reflection updates in `tests/integration/runtime/paper-position-monitoring.test.ts`

### Implementation for User Story 3

- [ ] T058 [P] [US3] Implement advanced market-data adapter fallbacks and typed degraded-mode results in `packages/market-data/src/dexscreener/dexscreener-adapter.ts`, `packages/market-data/src/sentiment/news-adapter.ts`, and `packages/market-data/src/fallbacks/provider-fallbacks.ts`
- [ ] T059 [P] [US3] Implement remaining indicators and chart-analysis helpers in `packages/indicators/src/basic/volume-trend.ts`, `packages/indicators/src/chart-analysis/multi-timeframe-alignment.ts`, `packages/indicators/src/advanced/supertrend.ts`, and `packages/indicators/src/advanced/fibonacci-zones.ts`
- [ ] T060 [P] [US3] Implement execution safeguards and testnet adapter in `packages/execution/src/safeguards/mainnet-guard.ts`, `packages/execution/src/hyperliquid-testnet/hyperliquid-testnet-adapter.ts`, and `packages/execution/src/paper/paper-position-monitor.ts`
- [ ] T061 [P] [US3] Implement config update endpoint and validation in `backend/src/api/config.controller.ts`, `backend/src/api/routes.ts`, and `packages/shared/src/schemas/demo-config-update.ts`
- [ ] T062 [US3] Implement monitor/reflection graph node and runtime monitoring loop in `packages/agents/src/definitions/monitor-agent.ts`, `backend/src/monitors/paper-position-monitor.ts`, and `backend/src/publishers/reflection-publisher.ts`
- [ ] T063 [US3] Implement uncertainty, disclaimer, and missing-data enforcement in `packages/agents/src/quality-gates/report-safety.ts` and `packages/agents/src/prompts/reporting/disclaimer.ts`
- [ ] T064 [US3] Build demo-config controls and safety banners in `frontend/src/components/mission-control/DemoConfigForm.tsx`, `frontend/src/components/ui/SafetyModeBanner.tsx`, and `frontend/src/hooks/useDemoConfig.ts`
- [ ] T065 [US3] Surface paper-position and monitor status in `frontend/src/components/signals/PaperPositionPanel.tsx` and `frontend/src/components/signals/MonitorHistory.tsx`

**Checkpoint**: User Story 3 delivers safe demo defaults, resilient fallbacks, and paper/testnet monitoring without changing the audit flows from US2.

---

## Phase 6: User Story 4 - Demonstrate Sponsor Alignment in Under Three Minutes (Priority: P4)

**Goal**: Provide a judge-friendly architecture view and exact demo walkthrough that highlights LangGraph.js orchestration, AXL inter-node messaging, 0G state/log writes, Supabase state, and Hyperliquid-safe usage.

**Independent Validation**: Follow the documented demo walkthrough from a clean local setup and confirm all sponsor-critical proof points appear in the architecture page and README/DEMO instructions.

### Validation for User Story 4

- [ ] T066 [P] [US4] Add Playwright test for the architecture/demo walkthrough page in `tests/e2e/architecture-demo-page.spec.ts`
- [ ] T067 [P] [US4] Add manual demo verification checklist to `specs/001-omen-swarm-runtime/quickstart.md`

### Implementation for User Story 4

- [ ] T068 [P] [US4] Build Architecture / Demo page in `frontend/src/pages/Architecture.tsx`, `frontend/src/components/architecture/SystemDiagram.tsx`, `frontend/src/components/architecture/AxlNetworkVisualization.tsx`, and `frontend/src/components/architecture/JudgeWalkthrough.tsx`
- [ ] T069 [P] [US4] Add LangGraph, AXL, 0G, Supabase, and Hyperliquid explainer content in `frontend/src/components/architecture/IntegrationCards.tsx` and `frontend/src/components/marketing/TechnicalHighlights.tsx`
- [ ] T070 [US4] Write project overview, setup, and sponsor integration docs in `README.md`
- [ ] T071 [US4] Write exact judge walkthrough in `DEMO.md`
- [ ] T072 [US4] Add local AXL node run helpers and docs scripts in `scripts/axl/start-orchestrator-node.ps1`, `scripts/axl/start-scanner-node.ps1`, `scripts/axl/start-research-node.ps1`, `scripts/axl/start-analyst-node.ps1`, and `scripts/axl/start-critic-node.ps1`

**Checkpoint**: User Story 4 makes the product judge-ready and demoable without adding new core runtime dependencies.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening, consistency, and end-to-end verification across all stories.

- [ ] T073 [P] Add contract/schema drift checks for `specs/001-omen-swarm-runtime/contracts/control-plane.openapi.yaml` and `packages/shared/src/schemas/*.ts` in `tests/integration/contracts/schema-drift.test.ts`
- [ ] T074 [P] Add AXL and 0G real-path smoke tests with clearly flagged fallbacks in `tests/integration/runtime/axl-smoke.test.ts` and `tests/integration/runtime/zero-g-smoke.test.ts`
- [ ] T075 Run full workspace lint/typecheck/test commands and record outputs in `README.md`
- [ ] T076 Run quickstart walkthrough validation and update troubleshooting notes in `specs/001-omen-swarm-runtime/quickstart.md`
- [ ] T077 [P] Perform copy audit for Omen-only branding in `frontend/src`, `backend/src`, `README.md`, and `DEMO.md`
- [ ] T078 [P] Optimize realtime rendering and loading states in `frontend/src/components/trace/TraceTimeline.tsx`, `frontend/src/components/mission-control/RunStatusPanel.tsx`, and `frontend/src/components/signals/SignalsTable.tsx`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup** has no dependencies and starts immediately.
- **Phase 2: Foundational** depends on Setup and blocks all user stories.
- **Phase 3: US1** depends on Foundational and is the MVP slice.
- **Phase 4: US2** depends on Foundational and can start after US1 runtime/event basics exist.
- **Phase 5: US3** depends on Foundational and benefits from US1 orchestration/repositories.
- **Phase 6: US4** depends on Foundational and can proceed in parallel with late US2/US3 work once architecture is stable.
- **Phase 7: Polish** depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational. No dependency on later stories.
- **US2 (P2)**: Depends on the event, message, and signal data produced by US1 but remains independently testable once those primitives exist.
- **US3 (P3)**: Depends on US1 runtime orchestration and signal publication but is independently testable as a safety/monitoring slice.
- **US4 (P4)**: Depends on stable architecture decisions and benefits from completed US1-US3 flows for screenshots and walkthrough accuracy.

### Within Each User Story

- Validation tasks should be written before story implementation is considered done.
- Repositories and schemas come before backend services and API routes.
- Backend/service logic comes before frontend integration.
- Story-specific UI work comes after the relevant API/query surface exists.

### Parallel Opportunities

- Setup tasks marked `[P]` can run in parallel.
- Foundational adapter, schema, indicator, and execution primitives marked `[P]` can run in parallel.
- Within US1, agent definitions, market adapters, and page components can be split across contributors.
- Within US2, repository/API work and UI trace/signal pages can be split after core event persistence is in place.
- Within US3, indicator work, adapter fallbacks, and safety UI can be split once the execution primitives exist.
- Within US4, architecture page work and documentation work can proceed in parallel.

---

## Parallel Example: User Story 1

```bash
# Validation
Task: "Add contract tests for control-plane run endpoints in tests/integration/contracts/runs-api.contract.test.ts"
Task: "Add integration test for one deterministic full swarm run in tests/integration/runtime/full-mocked-run.test.ts"
Task: "Add integration test for runtime command trigger and idempotent run start in tests/integration/runtime/start-demo-command.test.ts"

# Implementation
Task: "Implement market-bias and scanner graph nodes in packages/agents/src/definitions/market-bias-agent.ts and packages/agents/src/definitions/scanner-agent.ts"
Task: "Implement research, chart/vision, analyst, and critic graph nodes in packages/agents/src/definitions/research-agent.ts, packages/agents/src/definitions/chart-vision-agent.ts, packages/agents/src/definitions/analyst-agent.ts, and packages/agents/src/definitions/critic-agent.ts"
Task: "Build Mission Control page in frontend/src/pages/MissionControl.tsx and related components"
```

---

## Parallel Example: User Story 2

```bash
# Validation
Task: "Add contract tests for trace, signal, and 0G-ref endpoints in tests/integration/contracts/trace-and-signals-api.contract.test.ts"
Task: "Add Playwright audit-flow test for trace and signal detail pages in tests/e2e/audit-trace-and-signal-detail.spec.ts"

# Implementation
Task: "Implement GET /api/runs/[id]/trace, GET /api/signals, and GET /api/signals/[id] in backend/src/api/trace.controller.ts, backend/src/api/signals.controller.ts, and backend/src/api/routes.ts"
Task: "Build Agent Trace page in frontend/src/pages/AgentTrace.tsx and related components"
Task: "Build Signal Detail page in frontend/src/pages/SignalDetail.tsx and related components"
```

---

## Parallel Example: User Story 3

```bash
# Validation
Task: "Add unit tests for indicators and quality gates in packages/indicators/tests/basic-indicators.test.ts and packages/agents/tests/quality-gates.test.ts"
Task: "Add unit tests for critic logic and paper execution calculations in packages/agents/tests/critic-agent.test.ts and packages/execution/tests/paper-execution.test.ts"

# Implementation
Task: "Implement advanced market-data adapter fallbacks in packages/market-data/src/dexscreener/dexscreener-adapter.ts, packages/market-data/src/sentiment/news-adapter.ts, and packages/market-data/src/fallbacks/provider-fallbacks.ts"
Task: "Implement remaining indicators and chart-analysis helpers in packages/indicators/src/basic/volume-trend.ts, packages/indicators/src/chart-analysis/multi-timeframe-alignment.ts, packages/indicators/src/advanced/supertrend.ts, and packages/indicators/src/advanced/fibonacci-zones.ts"
Task: "Build demo-config controls and safety banners in frontend/src/components/mission-control/DemoConfigForm.tsx and frontend/src/components/ui/SafetyModeBanner.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate the separate backend/runtime, AXL messaging, 0G refs, and final report flow.
5. Demo the MVP before expanding the audit and safety surfaces.

### Incremental Delivery

1. Setup + Foundational create the shared contracts and infrastructure.
2. Add US1 for live demo-run capability.
3. Add US2 for full auditability and signal inspection.
4. Add US3 for safety defaults, paper monitoring, and degraded-mode resilience.
5. Add US4 for judge-facing presentation and walkthrough polish.

### Parallel Team Strategy

With multiple contributors:

1. One contributor owns workspace/setup and database foundation.
2. One contributor owns backend orchestration, LangGraph graphs, and event emission.
3. One contributor owns AXL and 0G adapters.
4. One contributor owns frontend surfaces and realtime query hooks.
5. One contributor owns tests, fixtures, and demo documentation.

---

## Notes

- `[P]` tasks touch distinct files or can proceed after their prerequisites are complete.
- User story labels map directly to the prioritized stories in `spec.md`.
- Every story includes explicit validation tasks.
- The suggested MVP scope is **US1 only**.
- Avoid mixing long-running runtime logic into frontend code paths.
- Keep `main` as the working branch for this repository workflow.
