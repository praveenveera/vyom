GarageBuild
व्योम
Engineering Document
Version 1.1  •  Phase 1 Complete  •  Alpha

This document covers the engineering standards, conventions, processes and governance for the GarageBuild project. It is intended for contributors, maintainers and the core team.

1. Technical Requirements

ID
Requirement
TR-001
Engine must be implemented in TypeScript on Node.js
TR-002
Desktop application must use Tauri (preferred) or Electron
TR-003
All plugin interfaces must be defined in the plugin-sdk package
TR-004
Database must be SQLite via better-sqlite3
TR-005
All database schema changes must use versioned migrations
TR-006
The engine must expose all functionality via a typed API — no UI may access internals directly
TR-007
The Event Bus must be the only mechanism for inter-subsystem communication
TR-008
All AI calls must go through the Model Abstraction Layer — no direct provider calls from the engine
TR-009
Monorepo must use Turborepo with each package independently buildable
TR-010
All packages must have unit tests with minimum 70% coverage before Phase 1 ships

2. Coding Standards

Language and Runtime
TypeScript strict mode everywhere — no any, no implicit returns, no untyped exports
Node.js LTS version — always on the current LTS, not the latest
ESM modules throughout — no CommonJS
Exception: VS Code extensions must use CommonJS because the VS Code extension host requires CJS. The ui-vscode package is the sole exception to this rule.
No barrel files (index.ts re-exports) — import directly from the source file

Naming Conventions
What
Convention
Example
Files
kebab-case
model-router.ts
Classes
PascalCase
ModelRouter
Interfaces
PascalCase with I prefix for implementations
IModelPlugin
Functions
camelCase
countTokens()
Constants
SCREAMING_SNAKE_CASE
MAX_RETRY_COUNT
Events
dot.separated.lowercase
message.created
Database tables
snake_case
token_usage
npm packages
@garagebuild/package-name
@garagebuild/plugin-openai

Code Style
Prettier for formatting — no exceptions, no manual overrides
ESLint with strict ruleset — all warnings treated as errors in CI
Maximum function length: 40 lines — extract if longer
Maximum file length: 300 lines — split if longer
No commented-out code committed — delete it or create an issue
Every public function must have a JSDoc comment

Error Handling
All async functions must handle errors explicitly — no unhandled promise rejections
Errors must be typed — never throw raw strings
User-facing errors must have a human-readable message and an error code
Internal errors must be logged with full context before being handled

Testing
Minimum 70% line coverage for all engine packages
Unit tests live next to the source file — model-router.test.ts
Integration tests live in packages/engine/tests/integration/
No test may make real API calls — all external calls must be mocked
Tests must run in under 30 seconds total

3. Git Conventions

Branch Naming
feat/short-description      (new features)fix/short-description       (bug fixes)docs/short-description      (documentation)chore/short-description     (maintenance)adr/decision-title          (architecture decision records)

Commit Messages
All commits follow Conventional Commits format:

type(scope): short descriptionTypes: feat | fix | docs | chore | refactor | test | perfScope: engine | plugin-sdk | ui-desktop | cli | plugin-openai | etcExamples:feat(engine): add event bus subsystemfix(plugin-openai): handle rate limit errors gracefullydocs(plugin-sdk): add model plugin interface referencechore(monorepo): update turborepo to v2

Pull Request Rules
Every PR must reference an issue or ADR
Every PR must pass all CI checks before review
Minimum one approval required from a core maintainer
PR description must include: what changed, why, how to test
No PR may decrease test coverage below the 70% threshold
Breaking changes require a major version bump and migration guide

4. Architecture Decision Records (ADRs)
Every significant architectural decision is recorded as an ADR. ADRs are stored in docs/adr/ and are numbered sequentially.

An ADR is required for any decision that affects: the engine API, the plugin interface contract, the domain model, the database schema, or the monorepo structure.

ADR Template
# ADR-{number}: {title}## StatusProposed | Accepted | Deprecated | Superseded by ADR-{n}## ContextWhat is the situation that requires a decision?## DecisionWhat did we decide?## ConsequencesWhat are the positive and negative outcomes of this decision?## Alternatives ConsideredWhat other options were evaluated and why were they rejected?

Existing ADRs
ADR
Decision
Status
ADR-001
Engine implemented in TypeScript on Node.js
Accepted
ADR-002
Desktop shell uses Tauri over Electron
Accepted
ADR-003
SQLite as primary database — PostgreSQL via plugin in Phase 5
Accepted
ADR-004
Event Bus as sole inter-subsystem communication mechanism
Accepted
ADR-005
npm as primary plugin distribution channel
Accepted
ADR-006
Three-tier plugin sandbox model (Trusted / Lightweight / Full)
Accepted
ADR-007
Model Abstraction Layer — engine never calls providers directly
Accepted
ADR-008
Turborepo as monorepo build system
Accepted
ADR-009
Plugin language support phased: TS → Python → Any
Accepted
ADR-010
Local-first storage at ~/.garagebuild with SQLite database
Accepted

5. RFC Process
Significant changes to GarageBuild — new subsystems, changes to the plugin contract, new plugin types, breaking API changes — require an RFC (Request for Comments) before implementation.

When an RFC Is Required
New engine subsystem
Any change to the plugin interface contracts
New plugin type
Changes to the domain model
Breaking changes to the engine API
New built-in plugins
Changes to the monorepo structure

RFC Process
Step
Action
1. Draft
Author creates RFC document in docs/rfcs/ using the template
2. Discussion
RFC is opened as a GitHub Discussion for community feedback — minimum 7 days
3. Revision
Author updates the RFC based on feedback
4. Decision
Core maintainers accept, reject or request further revision
5. Implementation
Accepted RFCs are implemented via standard PR process
6. Archive
Completed RFCs are marked as implemented with a link to the PR

RFC Template
# RFC-{number}: {title}## SummaryOne paragraph describing the change.## MotivationWhy is this change needed? What problem does it solve?## Detailed DesignHow will this be implemented? Include interfaces, data structures, flows.## DrawbacksWhat are the downsides of this approach?## AlternativesWhat other approaches were considered?## Unresolved QuestionsWhat still needs to be decided?

6. Plugin Certification
Plugins in the GarageBuild ecosystem are categorised into four tiers. Certification determines discoverability and trust level in the marketplace.

Tier
Label
Requirements
Who Grants
1
Official
Built and maintained by the GarageBuild core team
Core team only
2
Verified
Passes security audit, full test coverage, documented API
Core team review
3
Community
Published to npm, follows naming convention, has README
Self-published
4
Experimental
Any npm package matching garagebuild-plugin-* naming
Automatic

Sandbox tier minimum by certification: Official = Tier 1 allowed. Verified = Tier 2 minimum. Community = Tier 2 minimum. Experimental = Tier 3 required.

7. Versioning

Semantic Versioning
All packages follow semver: MAJOR.MINOR.PATCH

Change
Version Bump
Example
Breaking change to plugin interface or engine API
MAJOR
1.0.0 → 2.0.0
New capability, backward compatible
MINOR
1.0.0 → 1.1.0
Bug fix, performance improvement
PATCH
1.0.0 → 1.0.1

Plugin Compatibility
Plugins declare minGarageBuildVersion in their manifest
Engine rejects plugins incompatible with the running version
Breaking changes to plugin interfaces require a major engine version bump
A migration guide must be published with every major version

8. Security Model

API Key Storage
API keys stored in OS keychain via keytar where available
Fallback: AES-256 encrypted file at ~/.garagebuild/keys/
Keys never written to logs, error messages, or database
Keys never included in project exports or zip files
Keys are scrubbed from memory after use where possible

Plugin Security
Tier 1 plugins: same process, trusted, core team only
Tier 2 plugins: separate Node.js process, no shared memory, IPC only
Tier 3 plugins: WASM sandbox or container, no filesystem or network without explicit grant
Plugin manifests are validated against a JSON schema before loading
Plugins may not access engine internals — only the typed engine API

Plugin Permissions Model
Permission
Tier 1
Tier 2
Tier 3
File system access (project dir)
✅
✅ via IPC
✅ explicit grant
File system access (system)
✅
❌
❌
Network access
✅
✅ explicit
✅ explicit
OS keychain access
✅
❌
❌
Engine API access
✅
✅ via IPC
✅ via IPC
Spawn child processes
✅
❌
❌

Telemetry Philosophy
GarageBuild collects no telemetry by default. No usage data, no crash reports, no model usage statistics leave the user's machine without explicit opt-in.

Opt-in only — never opt-out
No personally identifiable information ever collected
No model prompts or generated code ever transmitted
If telemetry is enabled: only aggregate counts, no content

9. Project Governance

Roles
Role
Responsibilities
How to Become
Core Maintainer
Architecture decisions, RFC approval, release management
Invited by existing maintainers after sustained contribution
Committer
PR reviews, issue triage, merging approved PRs
Nominated after 10+ merged PRs
Contributor
PRs, issues, documentation, community support
Open to anyone

Decision Making
Routine changes: any committer can merge with one maintainer approval
Significant changes: RFC required, core maintainer consensus
Breaking changes: RFC required, unanimous core maintainer approval
Disputes: resolved by the project founder with input from core maintainers

Release Process
Step
Action
1. Feature freeze
No new features merged — bug fixes and docs only
2. Release candidate
RC published to npm with -rc.n suffix
3. Community testing
7-day testing period — issues tagged release-blocker
4. Final release
All blockers resolved, CHANGELOG updated, semver tag
5. Announcement
Release notes published to GitHub, Discord, blog

10. Contribution Guide

Getting Started
Fork the repository at github.com/garagebuild-dev/garagebuild
Clone your fork: git clone https://github.com/your-username/garagebuild
Install dependencies: npm install
Build all packages: npm run build
Run tests: npm run test
Start the desktop app: npm run dev:desktop

Before You Start
Check existing issues and PRs — your idea may already be in progress
For significant changes, open an issue or RFC before writing code
For bug fixes, a PR with a failing test is the fastest path to a merge

Writing a Plugin
Install the plugin SDK: npm install @garagebuild/plugin-sdk
Implement the correct interface for your plugin type
Create a garagebuild-plugin.json manifest
Write tests — minimum 70% coverage
Publish to npm following the naming convention
Submit to the marketplace via a PR to the community registry

Code of Conduct
GarageBuild follows the Contributor Covenant Code of Conduct. Be respectful, constructive and collaborative. Harassment, discrimination or personal attacks of any kind are not tolerated.

GarageBuild (व्योम)  •  Engineering Document v1.0  •  Build Once. Run Anywhere. Use Any AI. Own Everything.