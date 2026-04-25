# Feature Specification: Omen Autonomous Market-Intelligence Swarm

**Feature Branch**: `001-omen-swarm-runtime`  
**Created**: 2026-04-25  
**Status**: Draft  
**Input**: User description: "Build Omen as a production-oriented hackathon web platform and long-running autonomous agent runtime for decentralized crypto market intelligence."

## User Scenarios & Validation _(mandatory)_

### User Story 1 - Launch a Transparent Demo Run (Priority: P1)

A hackathon judge or operator starts a demo swarm run from Mission Control and sees multiple specialist agents coordinate in real time, exchange decentralized messages, write auditable memory, and produce either one approved market-intelligence report or a transparent no-signal outcome.

**Why this priority**: The primary demo value is proving autonomous swarm coordination, sponsor integration, and auditable decision flow, not static UI screens.

**Independent Validation**: Can be validated by starting one local demo run and confirming live status updates, agent participation, decentralized message flow, memory references, and a final published report or no-conviction report.

**Acceptance Scenarios**:

1. **Given** the dashboard, runtime, and local agent nodes are running, **When** the operator starts a demo run, **Then** the system creates a unique run, dispatches tasks to specialist agents, and shows live progress in Mission Control.
2. **Given** a run is in progress, **When** agents exchange sponsor-critical coordination messages and write memory updates, **Then** the dashboard shows those events with timestamps, sender/receiver context, and memory references.
3. **Given** the run completes, **When** the quality gates are evaluated, **Then** the system publishes either one approved signal report or a clear "no high-conviction setup found" report with supporting reasoning.

---

### User Story 2 - Audit Why a Signal Was Approved or Rejected (Priority: P2)

A judge or analyst opens a completed run and inspects the full evidence pack, analyst thesis, critic objections, chart outputs, decentralized message history, and memory references to understand exactly why the swarm produced its final outcome.

**Why this priority**: Transparency and auditability are the core differentiators for the hackathon positioning and must be visible after the live run ends.

**Independent Validation**: Can be validated by opening a completed run or signal detail page and confirming the full reasoning chain, objections, evidence, and memory/proof references are available without accessing server logs.

**Acceptance Scenarios**:

1. **Given** a completed run with an approved or rejected thesis, **When** a user opens the signal detail view, **Then** the UI shows the evidence pack, chart outputs, analyst thesis, critic decision, final report, and memory references in one place.
2. **Given** a user is reviewing a run timeline, **When** they filter by agent or message type, **Then** they can isolate analyst, critic, publisher, and message events without losing chronological context.

---

### User Story 3 - Operate the Swarm Safely in Demo Mode (Priority: P3)

A builder configures Omen for a repeatable hackathon demo where paper trading or testnet-only behavior is the default, noncritical data failures do not break the run, and the platform clearly avoids financial-advice or guaranteed-profit claims.

**Why this priority**: The demo must be safe, credible, and resilient enough to run live even if some market sources or sponsor services degrade.

**Independent Validation**: Can be validated by running the system in demo mode with one or more optional providers disabled and confirming the swarm still completes with fallback behavior, clear warnings, and no live-trading side effects.

**Acceptance Scenarios**:

1. **Given** real trading is not explicitly enabled, **When** a run is started, **Then** all execution behavior remains in paper or testnet mode and the UI labels that mode clearly.
2. **Given** an optional external market or news provider fails during a run, **When** the swarm continues, **Then** the final output records missing data and uncertainty instead of fabricating inputs or crashing the run.

---

### User Story 4 - Demonstrate Sponsor Alignment in Under Three Minutes (Priority: P4)

A hackathon presenter follows a short scripted walkthrough that starts multiple agent nodes, triggers a run, shows decentralized communications and memory writes, and lands on a final report plus proof references within a three-minute demo window.

**Why this priority**: Sponsor fit is only valuable if it is easy to demonstrate quickly and repeatedly under judging conditions.

**Independent Validation**: Can be validated by following the documented demo script from a clean local setup and confirming each sponsor-critical proof point appears in order.

**Acceptance Scenarios**:

1. **Given** the documented setup steps, **When** the presenter follows the demo script, **Then** they can show node status, message flow, memory writes, and final output without ad hoc shell investigation.

### Edge Cases

- If the market posture is neutral or no candidate passes quality gates, the system must publish a watchlist-only or no-conviction report instead of forcing an actionable signal.
- If one or more optional data adapters fail or rate-limit, the swarm must continue with typed degraded-mode behavior and record the missing inputs in the run trace and final report.
- If decentralized node communication becomes partially unavailable, the orchestrator must surface the failure, stop unsafe downstream steps, and persist the incomplete run state for inspection.
- If duplicate or near-duplicate candidate assets appear in the same run, the orchestrator must deduplicate them before final thesis generation.
- If chart data is unavailable for a requested timeframe, the report must mark the timeframe as unavailable and avoid claiming multi-timeframe confirmation from missing data.
- If a previous project name, token, asset, or branded copy appears in source or UI content, the build must treat it as a defect because Omen is a clean-room identity.
- If a monitor or reflection update arrives after a signal has already been invalidated or expired, the status history must remain auditable and ordered rather than overwriting earlier state.

## Requirements _(mandatory)_

### Functional Requirements

#### Product Identity and Scope

- **FR-001**: The system MUST be rebuilt and presented under the name `Omen`.
- **FR-002**: The system MUST NOT reference, preserve, or surface any previous project name, branding, copy, token, mascot, or legacy identity in user-visible flows, documentation, seeded data, or default configuration.
- **FR-003**: The system MUST position Omen as a decentralized autonomous market-intelligence swarm rather than a simple trading bot.
- **FR-004**: The system MUST emphasize transparency, auditability, decentralized coordination, persistent memory, and structured signal generation over profit claims.
- **FR-005**: Any trading or execution functionality MUST default to paper trading or testnet-only behavior.
- **FR-006**: Mainnet trading MUST be disabled by default and only become reachable through explicit environment-based enablement with clear warnings.

#### System Topology

- **FR-007**: The product MUST use a monorepo structure that separates the web control plane from the long-running autonomous runtime.
- **FR-008**: The dashboard/control plane MUST provide lightweight control and read operations only and MUST NOT host long-lived swarm execution inside request handlers.
- **FR-009**: A separate runtime process MUST handle scheduled runs, manual demo runs, agent orchestration, decentralized messaging, memory writes, and execution simulation.
- **FR-010**: The control plane MUST expose lightweight endpoints for starting runs, reading run state, reading traces, reading signals, reading agent status, reading peer status, reading memory references, and updating demo configuration.
- **FR-011**: The product MUST support local development mode, production mode, and deterministic mocked-demo mode.
- **FR-012**: The runtime MUST prevent overlapping runs by default unless a configuration setting explicitly allows concurrency.

#### Agent System

- **FR-013**: The system MUST define typed agent contracts for inputs, outputs, tool permissions, trace logging, and failure handling.
- **FR-014**: The system MUST support framework abstraction so the orchestration layer can be swapped later without rewriting business logic.
- **FR-014a**: The initial implementation SHOULD use LangGraph.js as the primary agent orchestration framework for graph-based multi-agent control flow, checkpointing, and streaming.
- **FR-015**: Every agent MUST have a unique identity, role description, input contract, output contract, tool permission policy, trace log, failure behavior, and deterministic fallback for external API failures.
- **FR-016**: The system MUST include, at minimum, the following roles: orchestrator, market bias, scanner, research, chart/vision, analyst, critic/risk, memory, publisher, and monitor/reflection.
- **FR-017**: At least four specialist agents MUST participate in each demo run.
- **FR-018**: The orchestrator MUST create and persist a run identifier before dispatching work.
- **FR-019**: The orchestrator MUST cap candidates at three per run and cap final approved signals at one per run by default.
- **FR-020**: The market bias stage MUST determine long, short, or neutral posture before candidate selection.
- **FR-021**: The scanner stage MUST explain why each candidate deserves deeper analysis.
- **FR-022**: The analyst stage MUST produce a structured thesis including direction, entry zone, invalidation, take-profit levels, confidence, risk/reward, why-now reasoning, uncertainty notes, and missing-data notes.
- **FR-023**: The critic stage MUST evaluate weak confluence, poor risk/reward, liquidity issues, conflicting timeframes, overextended entries, funding crowding, and weak catalysts, and MUST be able to reject a signal or force a watchlist-only outcome.
- **FR-024**: The publisher stage MUST generate public, judge/demo, and compact alert report formats from the approved or rejected final state.
- **FR-025**: The monitor/reflection stage MUST track post-publication status changes and append outcome reflections to durable memory.

#### Market Intelligence and Analysis

- **FR-026**: The system MUST gather market context from configured exchange, market, protocol, and DEX liquidity providers through isolated adapters.
- **FR-027**: All external data adapters MUST return typed success or typed failure states and MUST support graceful degradation.
- **FR-028**: The swarm MUST complete a demo run even when one or more noncritical providers are unavailable.
- **FR-029**: The system MUST never fabricate unavailable market, liquidity, sentiment, or catalyst data.
- **FR-030**: The system MUST support basic explainable indicators including RSI, MACD, moving averages, Bollinger Bands, volume trend, support/resistance approximation, and multi-timeframe alignment.
- **FR-031**: The system SHOULD support advanced confluence features such as CVD approximation, order block zones, fair value gaps, volume profile or point-of-control approximation, SuperTrend, VW-MACD, and Fibonacci retracement zones when practical.
- **FR-032**: The chart analysis flow MUST support at least 4H, 1H, and 15M views when source data exists.
- **FR-033**: Each final report MUST explain the indicators and confluences used in plain language.

#### Quality Gates

- **FR-034**: The system MUST require a minimum default confidence threshold of 85 before publishing an actionable signal.
- **FR-035**: The system MUST require a minimum default risk/reward threshold of 1:2 before publishing an actionable signal.
- **FR-036**: The system MUST require at least two independent confluences before publishing an actionable signal.
- **FR-037**: The system MUST require multi-timeframe alignment for actionable signals unless the final report explicitly documents why alignment was not required.
- **FR-038**: The system MUST require critic approval before publishing an actionable signal.
- **FR-039**: If no candidate passes the quality gates, the system MUST publish a transparent "no high-conviction setup found" or watchlist-only outcome.
- **FR-040**: Every final report MUST include invalidation, uncertainty, and missing-data disclosures.
- **FR-041**: The system MUST prevent duplicate signals for materially identical candidate setups within the same run.

#### Decentralized Messaging

- **FR-042**: Sponsor-critical inter-agent communication MUST use Gensyn AXL rather than an in-process-only or centralized-only message path.
- **FR-043**: The system MUST provide an internal AXL adapter that can register nodes, send direct messages, receive messages, broadcast messages, and report peer status.
- **FR-044**: The demo MUST show at least three separate logical AXL nodes exchanging messages during a run.
- **FR-045**: The scanner, research, analyst, critic, and orchestrator or publisher roles MUST be able to run as separate logical AXL nodes.
- **FR-046**: Every recorded decentralized message MUST include run ID, sender ID, receiver ID or topic, message type, payload, timestamp, correlation ID, and optional durable-memory reference.
- **FR-047**: The dashboard MUST visualize decentralized message flow as a live timeline, graph, or equivalent operator-facing view.
- **FR-048**: Documentation MUST explain how to run multiple local AXL nodes for the demo.

#### Durable Memory and Proofs

- **FR-049**: Sponsor-critical swarm state and proofs MUST use 0G as a core system component rather than decorative metadata.
- **FR-050**: The system MUST provide an internal 0G adapter with operations to put current state, get current state, append run logs, read run logs, submit inference jobs, read inference results, and optionally register signal proofs.
- **FR-051**: The system MUST store current swarm state, latest market bias, active candidates, latest agent statuses, and current run checkpoint in 0G key-value storage.
- **FR-052**: The system MUST append agent debate traces, decentralized message receipts, analyst outputs, critic outputs, final reports, and monitor/reflection updates to 0G durable logs.
- **FR-053**: At least one inference, reflection, or report-synthesis path MUST use a real 0G-backed compute path or a clearly marked adapter-backed example path with one working 0G example.
- **FR-054**: The dashboard MUST expose memory and proof references so judges can see what state or log artifacts were written for each run.
- **FR-055**: If optional chain proof registration is implemented, the system MUST show the contract address and transaction reference in the UI when available.

#### Application Data and Dashboard Experience

- **FR-056**: The dashboard MUST provide the following primary views: landing page, Mission Control, Agent Trace, Signals list, Signal Detail, and Architecture/Demo page.
- **FR-057**: Mission Control MUST allow an operator to start a demo run and inspect current run status, active agents, node status, and recent memory writes.
- **FR-058**: Agent Trace MUST show chronological agent actions, decentralized messages, and durable-memory references with filtering by agent.
- **FR-059**: Signals views MUST show confidence, direction, entry, targets, invalidation, status, critic approval state, and proof references for each published outcome.
- **FR-060**: Signal Detail MUST show the full thesis, evidence pack, chart outputs, analyst output, critic objections, final report, and memory/proof references.
- **FR-061**: The Architecture/Demo page MUST explain how the orchestration layer, decentralized node messaging, durable memory, compute path, and dashboard state fit together for judges.
- **FR-062**: The visual design MUST feel polished and demo-ready while prioritizing clarity and auditability over aggressive profit marketing.

#### Database and State

- **FR-063**: The application database MUST support run history, agent events, decentralized message metadata, durable-memory references, signals, evidence, signal status updates, agent node status, and app configuration.
- **FR-064**: Sponsor-critical memory and proofs MUST live in 0G, while the application database stores queryable dashboard state and operator-facing metadata.
- **FR-065**: The project MUST include migrations and seed or fixture data for repeatable local demos.
- **FR-066**: The runtime MUST emit live updates that can be consumed by the dashboard through realtime subscriptions, websockets, or server-sent events.

#### Safety, Trust, and Content Handling

- **FR-067**: All public-facing outputs MUST include language stating the content is market intelligence for informational purposes and not financial advice.
- **FR-068**: The system MUST NOT promise profits, guaranteed accuracy, or unrealistic win rates.
- **FR-069**: Every decision path MUST record the data sources and reasoning inputs used.
- **FR-070**: Untrusted news, social, or search content MUST be summarized or sanitized before it is used in agent reasoning to reduce prompt-injection risk.
- **FR-071**: The system MUST surface missing data, degraded-mode behavior, and safety mode in the UI and final reports rather than hiding them.

#### Documentation and Demo Readiness

- **FR-072**: The README MUST explain the project overview, hackathon prize alignment, architecture, setup, environment variables, frontend startup, control-plane startup, runtime startup, local node startup, 0G usage, compute usage, demo script, limitations, and safety disclaimers.
- **FR-073**: The project MUST include a `DEMO.md` with an exact judge walkthrough covering node startup, runtime startup, dashboard startup, run trigger, decentralized message inspection, memory/log inspection, final report inspection, and critic/proof inspection.
- **FR-074**: The project MUST include a single root `.env` and `.env.example` for local setup, and MUST NOT require app-specific environment files.
- **FR-075**: The codebase MUST include unit coverage for schemas, adapter mocks, indicator logic, quality gates, critic logic, and sponsor adapter mocks, plus integration coverage for one deterministic mocked swarm run and its resulting trace, signal, memory references, and message records.

### Key Entities _(include if feature involves data)_

- **Run**: A single autonomous swarm session with a unique ID, lifecycle status, market bias, configuration snapshot, checkpoint state, timestamps, and final outcome summary.
- **Agent Node**: A logical swarm participant with identity, role, node status, tool permissions, peer health, and latest heartbeat or status summary.
- **Agent Event**: A chronological action emitted by an agent, including event type, payload summary, timestamp, severity, correlation identifiers, and optional memory references.
- **AXL Message**: A decentralized inter-node message containing run context, sender, receiver or topic, message type, payload, timestamp, correlation ID, delivery state, and optional durable-memory reference.
- **Signal Candidate**: An asset or setup shortlisted for deeper analysis, including symbol, market context, reason for selection, data availability summary, and deduplication state.
- **Evidence Pack**: The structured research bundle for a candidate, combining market data, technical context, liquidity context, catalysts, sentiment summary, chart outputs, and missing-data notes.
- **Signal Thesis**: The analyst-produced trade or watchlist thesis containing direction, entry zone, invalidation, targets, confidence, risk/reward, why-now narrative, confluences, uncertainty, and current approval status.
- **Risk Review**: The critic decision record containing pass or reject status, objections, rejected conditions, and any forced watchlist-only rationale.
- **Memory Reference**: A user-visible pointer to durable swarm state, log entries, compute jobs, or optional chain proofs associated with a run or signal.
- **Signal Status Update**: A post-publication lifecycle entry such as active, invalidated, target hit, stopped, expired, or watchlist only, with timestamps and reflection notes.
- **App Configuration**: A mutable demo-safe configuration profile controlling market universe, runtime mode, data adapters, thresholds, and execution permissions.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A first-time reviewer can start a local demo run from the dashboard and reach a final report or no-conviction outcome in 10 minutes or less after completing documented setup.
- **SC-002**: Every demo run records participation from at least four specialist agents and shows at least three distinct decentralized node message exchanges in the operator UI.
- **SC-003**: 100% of completed demo runs expose user-visible durable-memory references for current state and chronological log artifacts associated with the run.
- **SC-004**: 100% of published reports include confidence, risk/reward, invalidation, evidence summary, critic outcome, uncertainty notes, and the informational-not-financial-advice disclaimer.
- **SC-005**: In mocked-demo mode, one deterministic end-to-end run completes successfully even if at least one noncritical external provider is disabled.
- **SC-006**: The documented judge walkthrough can demonstrate startup, live coordination, memory writes, and final outcome review within three minutes.
- **SC-007**: Zero legacy project names or legacy token references remain in default UI copy, documentation, seeded demo data, or configuration after the rebuild is completed.

## Assumptions

- The primary users for the first release are hackathon judges, demo operators, and technically fluent early adopters rather than retail end users.
- Local demo mode may use mocked or fixture-backed data when live APIs are rate-limited, unavailable, or unsuitable for deterministic judging.
- Sponsor services, SDKs, or credentials may be partially unavailable during development, so adapter boundaries and clearly labeled fallbacks are acceptable as long as at least one working sponsor-backed path is demonstrable.
- Authentication, multi-tenant user management, billing, and permissioned collaboration are out of scope for the first hackathon release unless needed to support the local demo.
- The default runtime posture is safety-first, with paper or testnet behavior enabled and real execution requiring explicit operator configuration outside the default demo path.
