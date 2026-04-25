# Implementation Plan: Omen Autonomous Market-Intelligence Swarm

**Branch**: `main` | **Date**: 2026-04-25 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-omen-swarm-runtime/spec.md`

**Note**: Repository policy for this project is to work on `main` only. The stock Speckit `setup-plan` script was not used because it hard-requires a numbered feature branch.

## Summary

Build Omen as a pnpm TypeScript monorepo with a Next.js control plane in `apps/web`, a Node.js runtime service in `apps/runtime`, and shared packages for agents, AXL, 0G, market data, indicators, execution, database access, and shared schemas. The runtime owns LangGraph.js-based orchestration, decentralized AXL communication, 0G state/log writes, market scans, paper/testnet execution, and monitoring; the web app owns operator actions, dashboard reads, and live trace presentation through lightweight APIs and realtime subscriptions.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 22 LTS  
**Primary Dependencies**: Next.js App Router, React, Tailwind CSS, shadcn/ui, Zod, Supabase JS, LangGraph.js, LangChain core packages, Hyperliquid API client adapter, `@0gfoundation/0g-ts-sdk`, AXL local-node HTTP bridge, Vitest, Playwright, pnpm workspaces  
**Storage**: Supabase Postgres for dashboard-readable state; 0G Storage KV for mutable swarm state; 0G Storage Log/file-backed artifacts for durable traces and reports  
**Validation Strategy**: pnpm lint, pnpm typecheck, unit tests for schemas/adapters/indicators/gates, integration tests for one deterministic swarm run, plus a manual hackathon-demo smoke walkthrough  
**Target Platform**: Linux/macOS/Windows developer machines for local demo; container-friendly Node.js deployment for production-like mode  
**Project Type**: Monorepo Next.js application plus separate Node.js runtime service and shared packages  
**Performance Goals**: Demo run trigger acknowledged in under 2 seconds; Mission Control updates visible within 1 second of emitted runtime events in local mode; deterministic mocked demo completes in under 90 seconds; primary dashboard pages render interactive content in under 3 seconds on local broadband  
**Constraints**: No long-lived agent execution inside Next.js routes; work on `main` only; 0G and AXL must be core to sponsor path; real-money execution disabled by default; all external inputs validated and sanitized; runtime must tolerate partial provider failures  
**Scale/Scope**: 1 operator-facing dashboard, 1 separate runtime, 9-10 agent roles, at least 3 logical AXL nodes, up to 3 candidates per run, 1 approved signal per run, deterministic fixtures for demo resilience

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Code Quality: Enforce `pnpm lint`, `pnpm typecheck`, package-level strict TypeScript, consistent repository-wide formatting, and adapter boundaries so business logic is isolated from vendor SDK churn.
- Validation: Add requirement-level automated coverage because the feature explicitly asks for unit and integration tests; also require a local demo smoke script proving run start, live trace, 0G refs, AXL messages, and final output.
- UX Consistency: Use a single dark visual system in the web app with shared layout primitives, status tokens, trace cards, and proof-reference components so transparency-first behavior is consistent across Mission Control, Trace, and Signal views.
- Performance: Budget sub-2s start-demo response, sub-1s local event propagation to UI, and sub-90s deterministic full demo run; verify via integration tests plus manual timing during quickstart walkthrough.

Gate status: PASS. No constitution violation requires exception handling in this plan.

## Project Structure

### Documentation (this feature)

```text
specs/001-omen-swarm-runtime/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── control-plane.openapi.yaml
│   └── runtime-events.schema.json
└── tasks.md
```

### Source Code (repository root)

```text
apps/
├── web/
│   ├── app/
│   │   ├── (marketing)/
│   │   ├── mission-control/
│   │   ├── agent-trace/
│   │   ├── signals/
│   │   ├── signals/[id]/
│   │   ├── architecture/
│   │   └── api/
│   │       ├── runs/
│   │       ├── signals/
│   │       ├── agents/
│   │       ├── axl/
│   │       ├── 0g/
│   │       └── config/
│   ├── components/
│   ├── lib/
│   └── styles/
└── runtime/
    ├── src/
    │   ├── bootstrap/
    │   ├── commands/
    │   ├── coordinator/
    │   ├── nodes/
    │   ├── pipelines/
    │   ├── publishers/
    │   ├── monitors/
    │   └── workers/
    └── tests/

packages/
├── agents/
│   ├── src/
│   │   ├── framework/
│   │   ├── definitions/
│   │   ├── prompts/
│   │   ├── tools/
│   │   └── quality-gates/
│   └── tests/
├── axl/
│   ├── src/
│   │   ├── adapter/
│   │   ├── node-client/
│   │   ├── message-envelope/
│   │   └── peer-status/
│   └── tests/
├── zero-g/
│   ├── src/
│   │   ├── storage/
│   │   ├── compute/
│   │   ├── chain/
│   │   └── adapters/
│   └── tests/
├── market-data/
│   ├── src/
│   │   ├── hyperliquid/
│   │   ├── binance/
│   │   ├── coingecko/
│   │   ├── defillama/
│   │   ├── dexscreener/
│   │   └── sentiment/
│   └── tests/
├── db/
│   ├── src/
│   │   ├── client/
│   │   ├── repositories/
│   │   ├── realtime/
│   │   └── seeds/
│   ├── migrations/
│   └── tests/
├── shared/
│   ├── src/
│   │   ├── schemas/
│   │   ├── types/
│   │   ├── constants/
│   │   └── utils/
│   └── tests/
├── indicators/
│   ├── src/
│   │   ├── basic/
│   │   ├── advanced/
│   │   └── chart-analysis/
│   └── tests/
└── execution/
    ├── src/
    │   ├── paper/
    │   ├── hyperliquid-testnet/
    │   └── safeguards/
    └── tests/

tests/
├── integration/
├── fixtures/
└── e2e/
```

**Structure Decision**: Use a pnpm monorepo with `apps/web` and `apps/runtime` as top-level executables and all vendor integrations isolated in focused packages. This keeps Next.js as a thin control plane and prevents direct coupling between agent logic and infrastructure vendors.

## Phase 0: Research Direction

Phase 0 resolves the key implementation decisions needed before tasks:

1. Use Supabase as the operator-state system of record and 0G as the sponsor-critical durable-memory system of record.
2. Use AXL local nodes as the actual inter-node transport and wrap their HTTP API with a TypeScript adapter in `packages/axl`.
3. Use 0G Storage KV for mutable state checkpoints and 0G Storage Log/file artifacts for append-only trace and report durability via `packages/zero-g`.
4. Use one real 0G Compute-backed path for report synthesis or reflection if the broker path is practical; otherwise preserve the boundary and ship a clearly flagged development fallback.
5. Use Hyperliquid primarily for perp universe, mids, candles, funding/account context, paper trading, and optional testnet execution, never as default mainnet execution.
6. Keep LangGraph.js behind an internal `AgentRuntime` interface so agent roles, prompts, graph topology, and tool wiring remain portable if framework APIs shift.

## Phase 1: Design & Contracts

### Architecture Decisions

- `apps/web` issues only short-lived commands and queries. `POST /api/runs/start-demo` writes a runtime command record or sends a local RPC trigger, then returns immediately.
- `apps/runtime` is a standalone Node.js service that owns the command loop, idempotent run start, LangGraph supervisor/workflow graphs, node communications, state persistence, and monitor loop.
- Shared schemas in `packages/shared` define all API contracts, event envelopes, adapter results, agent IO, and persisted entity shapes.
- `packages/agents` defines role contracts, LangGraph.js state annotations, graph nodes/subgraphs, quality gates, prompt templates, and dependency-injected tool facades. Agents do not import Supabase, 0G, AXL, or raw market SDKs directly.
- `packages/db` exposes repository APIs for runs, events, messages, refs, signals, evidence, app config, and paper positions.
- `packages/market-data` normalizes upstream APIs into typed result unions with explicit degraded-mode metadata.
- `packages/execution` translates approved signals into paper positions and optional Hyperliquid testnet actions behind a safety gate.
- LangGraph checkpointers map runtime `runId` to graph `thread_id`, while Supabase and 0G persist the operator-visible and decentralized views of that execution history.

### Delivery Slices

1. Monorepo foundation and shared schemas.
2. Database and seed fixtures.
3. Runtime command loop and live event pipeline.
4. 0G and AXL adapters with mocks and one real path each.
5. Agent orchestration and quality-gate flow.
6. Dashboard pages and realtime trace surfaces.
7. Paper/testnet monitoring and final documentation/demo script.

### Post-Design Constitution Check

- Code Quality: PASS. Package boundaries and typed adapters keep complexity localized.
- Validation: PASS. Every major slice maps to unit and integration coverage plus a demo smoke script.
- UX Consistency: PASS. All dashboard surfaces share a single transparency-first design language.
- Performance: PASS. Runtime and UI are separated, and realtime/event budgets are measurable and testable.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
