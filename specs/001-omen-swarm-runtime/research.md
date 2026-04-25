# Research: Omen Autonomous Market-Intelligence Swarm

## Decision 1: Use a pnpm TypeScript monorepo with two executable apps

**Decision**: Structure the project as `apps/web` and `apps/runtime` plus focused shared packages.

**Rationale**: The dashboard and the swarm runtime have different lifecycles, failure modes, and scaling needs. A monorepo keeps types and contracts synchronized while allowing the runtime to remain long-lived and operationally separate from Next.js.

**Alternatives considered**:
- Single Next.js app with background jobs: rejected because it blurs control-plane and compute-plane concerns.
- Separate repos: rejected because shared schemas, adapter contracts, and demo coordination would become harder to keep in sync during the hackathon.

## Decision 2: Use Supabase for queryable app state and 0G for durable sponsor-critical memory

**Decision**: Persist runs, signals, traces, peer status, and dashboard state in Supabase while writing swarm checkpoints and durable logs to 0G.

**Rationale**: The spec requires that judges can inspect app-readable state quickly while sponsor-critical evidence remains decentralized and auditable. Local 0G docs distinguish mutable key-value storage from append-only log/file storage, which maps naturally to current state vs durable debate/report artifacts.

**Alternatives considered**:
- Supabase only: rejected because it weakens the sponsor-critical 0G story.
- 0G only: rejected because dashboard queries, filters, and realtime UX become unnecessarily heavy.

## Decision 3: Model 0G integration around adapter boundaries, not direct SDK use in app code

**Decision**: Implement `packages/zero-g` with explicit operations for mutable state, log appends, compute submission, result polling, and optional chain proof registration.

**Rationale**: The local 0G TypeScript SDK exposes storage-centric primitives such as file upload/download, node selection, and KV writes. Those capabilities are lower level than Omen’s business actions, so an adapter layer is required to keep the runtime stable if SDK mechanics or endpoints change.

**Alternatives considered**:
- Call the 0G SDK directly from agents and routes: rejected because it tightly couples product logic to low-level storage mechanics.
- Mock 0G entirely for the demo: rejected because the hackathon requirements call for at least one real 0G-backed path.

## Decision 4: Use 0G Storage KV for checkpoints and mutable swarm state

**Decision**: Store the latest market bias, current run checkpoint, active candidates, and latest agent statuses in 0G KV.

**Rationale**: The 0G docs describe KV storage as the mutable layer intended for fast key-based retrieval and dynamic state, which fits Omen’s current-status and resume/checkpoint use cases.

**Alternatives considered**:
- Put all state into append-only logs: rejected because reconstructing current state becomes slower and more error-prone.
- Store mutable state only in Supabase: rejected because sponsor-critical current state would not live in 0G.

## Decision 5: Use 0G append-only artifacts for traces, debate history, and final reports

**Decision**: Persist agent debate traces, AXL receipts, analyst outputs, critic outputs, final reports, and reflection updates as durable 0G log/file artifacts referenced from Supabase.

**Rationale**: The local storage docs describe append-only storage as appropriate for immutable or write-once workloads. Omen’s audit trail is naturally append-only and should remain tamper-evident and externally referenceable.

**Alternatives considered**:
- Keep full trace history only in Postgres: rejected because it weakens auditability and sponsor alignment.

## Decision 6: Treat 0G Compute as an optional-but-real inference backend behind one focused path

**Decision**: Use one concrete 0G Compute-backed path first, most likely final report synthesis or reflection generation, and gate it behind an adapter that can fall back locally in development mode.

**Rationale**: The local 0G compute docs emphasize decentralized inference with OpenAI-compatible access patterns and provider verification. Shipping one real path is sufficient for sponsor credibility while limiting integration risk during the hackathon.

**Alternatives considered**:
- Route every agent inference through 0G Compute: rejected because it adds latency, operational dependencies, and debugging complexity to the entire swarm.
- Skip 0G Compute entirely: rejected because the acceptance criteria call for a real path or clearly working adapter-backed example.

## Decision 7: Use AXL nodes as the actual inter-node transport and wrap them in a TypeScript client

**Decision**: Run multiple AXL node processes locally and communicate with them from `packages/axl` via the node’s HTTP bridge endpoints.

**Rationale**: The local AXL docs show a userspace node with a local HTTP API exposing `/topology`, `/send`, `/recv`, `/mcp/{peer}/{service}`, and `/a2a/{peer}`. That makes it practical to treat AXL as a true decentralized transport while keeping Omen’s runtime in TypeScript.

**Alternatives considered**:
- Replace AXL with Redis or an internal event bus: rejected because the sponsor-critical path must not be centralized.
- Embed AXL implementation details directly into the runtime: rejected because the runtime should depend on an adapter, not Go-node specifics.

## Decision 8: Use A2A-style JSON envelopes for structured agent messaging

**Decision**: Normalize all inter-node messages into a typed Omen envelope with run ID, sender, receiver, message type, payload, timestamp, correlation ID, and optional 0G reference, then transport those envelopes through the AXL bridge.

**Rationale**: The local AXL docs show request/response A2A messaging using JSON-RPC envelopes and a client-assigned `messageId` correlation field. A typed envelope gives the dashboard, persistence layer, and replay tooling a stable record shape independent of raw transport.

**Alternatives considered**:
- Use raw binary `/send` only: rejected because dashboard inspection and typed auditing would become harder.

## Decision 9: Keep agents infrastructure-agnostic through dependency injection

**Decision**: Agents consume tool interfaces such as market data, memory, messaging, charting, and execution through injected facades rather than importing vendor clients.

**Rationale**: This preserves testability, deterministic fixtures, and future framework portability. It also aligns with the requirement that agents not depend directly on Supabase, 0G, AXL, or raw market APIs.

**Alternatives considered**:
- Let each agent import its own adapters: rejected because it would create hidden coupling and make mocking difficult.

## Decision 10: Use LangGraph.js as the primary orchestration framework behind an internal runtime abstraction

**Decision**: Define an internal `AgentRuntime` and `AgentExecutionContext` interface in `packages/agents`, then implement that runtime with LangGraph.js graphs, nodes, `Command`-based handoffs, typed state, and checkpointers.

**Rationale**: The local LangGraph.js docs are a better fit for Omen's architecture than a generic agent shell because they explicitly support supervisor and custom multi-agent workflows, graph-level state transitions, checkpoint persistence via `thread_id`, and streaming of graph updates, tokens, and tool progress. That maps directly to Omen's needs for orchestrator-led specialist routing, resumable runs, live trace updates, and auditable state progression.

**Alternatives considered**:
- Hard-code LangGraph.js primitives across the entire codebase: rejected because it increases migration risk and makes framework swaps harder.
- Use a single-agent loop without graph orchestration: rejected because Omen needs explicit multi-agent routing, critic gates, and resumable checkpoints.

## Decision 11: Use Hyperliquid as the primary perp-universe and paper/testnet execution context

**Decision**: Prioritize Hyperliquid for universe metadata, mids, candles where practical, funding/account context, paper simulation, and optional testnet execution, while keeping Binance and others as secondary market-data enrichers.

**Rationale**: The official Hyperliquid info endpoint supports all-market mids and candle snapshots, making it a strong source for perp-centric signal monitoring and simulation. This supports the sponsor-safe positioning of market intelligence plus paper/testnet execution.

**Alternatives considered**:
- Use Binance as the primary perp execution context: rejected because the requested direction keeps Hyperliquid central.
- Enable mainnet execution by default: rejected by product safety requirements.

## Decision 12: Record every meaningful runtime action as a first-class event

**Decision**: Define a normalized `agent_events` model and emit events for run creation, node communication, 0G writes, research completion, thesis generation, critic decisions, report publication, paper-position lifecycle changes, and reflections.

**Rationale**: The dashboard’s transparency promise depends on a unified trace model rather than ad hoc logging. A single event stream can drive UI timelines, realtime updates, audits, and deterministic replay/testing.

**Alternatives considered**:
- Separate bespoke logs per subsystem: rejected because it fragments observability and complicates replay.
