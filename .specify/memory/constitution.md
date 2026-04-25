<!--
Sync Impact Report
- Version change: 0.0.0 -> 1.0.0
- Modified principles:
	- Template principle slot 1 -> I. Code Quality Is Non-Negotiable
	- Template principle slot 2 -> II. Validation Over Mandatory Test Suites
	- Template principle slot 3 -> III. User Experience Consistency
	- Template principle slot 4 -> IV. Performance Budgets Are Required
- Added sections:
	- Engineering Standards
	- Delivery Workflow & Quality Gates
- Removed sections:
	- Template principle slot 5 (removed in favor of a four-principle model)
- Templates requiring updates:
	- ✅ .specify/templates/plan-template.md
	- ✅ .specify/templates/spec-template.md
	- ✅ .specify/templates/tasks-template.md
	- ⚠ pending: .specify/templates/commands/*.md (directory not present)
- Deferred TODOs:
	- None
-->

# Omen Constitution

## Core Principles

### I. Code Quality Is Non-Negotiable
All production code MUST be readable, maintainable, and reviewable. Every
change MUST pass formatting, linting, and static analysis checks configured for
the repository before merge. Complex implementations MUST include concise
rationale in code comments or design docs when intent is not obvious.
Rationale: high code quality reduces regressions, onboarding time, and long-term
maintenance cost.

### II. Validation Over Mandatory Test Suites
Automated tests are OPTIONAL by default and MUST be required only when the
feature specification explicitly asks for them. Every delivered change MUST
include explicit validation evidence (manual checks, acceptance walkthroughs,
or automated checks) tied to requirements, so quality does not depend on a
single testing approach.
Rationale: this project optimizes for delivery flexibility while preserving
accountability for correctness.

### III. User Experience Consistency
User-facing behavior MUST follow established interaction patterns, visual style,
terminology, and accessibility expectations already present in the product.
Any intentional UX deviation MUST be documented with rationale and user impact
in the relevant specification or plan before implementation.
Rationale: consistency improves trust, usability, and supportability.

### IV. Performance Budgets Are Required
Each feature MUST define measurable performance expectations (for example,
latency, throughput, rendering speed, or memory use) during planning. Changes
MUST NOT introduce significant regressions against agreed budgets, and validation
results MUST be captured in implementation artifacts.
Rationale: performance is a core quality attribute and must be managed as a
first-class requirement.

## Engineering Standards

- Specifications and plans MUST state code quality checks, UX consistency checks,
	and performance expectations before implementation starts.
- Pull requests MUST include evidence that the selected validation strategy was
	executed and passed for the implemented scope.
- Dependencies, architecture choices, and technical debt tradeoffs SHOULD be
	explicit when they affect maintainability or performance.

## Delivery Workflow & Quality Gates

- The Constitution Check in planning MUST evaluate all four core principles.
- Tasks MUST include requirement-level validation activities; automated tests are
	included only when explicitly requested by the feature spec.
- Reviews MUST reject work that lacks quality, UX consistency, or performance
	evidence for the claimed scope.

## Governance

This constitution supersedes conflicting workflow guidance in repository
artifacts. Amendments require: (1) a documented proposal, (2) explicit update
of dependent templates and guidance files, and (3) a recorded semantic version
increment rationale.

Versioning policy is semantic:
- MAJOR: backward-incompatible governance or principle removals/redefinitions.
- MINOR: new principle/section or materially expanded mandatory guidance.
- PATCH: clarifications, wording improvements, and non-semantic refinements.

Compliance reviews are mandatory at planning and pull request review time.
Non-compliant work MUST be corrected or explicitly approved as a documented
exception by project maintainers.

**Version**: 1.0.0 | **Ratified**: 2026-04-25 | **Last Amended**: 2026-04-25
