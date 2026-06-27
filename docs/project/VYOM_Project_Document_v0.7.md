VYOM
व्योम
Open AI Development Platform
Working Document  •  Version 0.7  •  Vision & Product Discovery
Infinite Space  •  Sky  •  Universe  •  Boundless

Vision:  The open-source AI development platform that runs anywhere, uses any AI, and keeps you in complete control.
Motto: Build Once. Run Anywhere. Use Any AI. Own Everything.

1. Introduction
This document captures the current vision, discussions, decisions and future direction of the VYOM project.
The purpose of this document is to serve as the primary context for any AI assistant (ChatGPT, Claude, Gemini, etc.) or contributor joining the project.
This is not a finalized specification. It represents the current understanding and direction of the platform.

About the Name
VYOM (व्योम) is a Sanskrit word meaning Infinite Space, Sky, Universe and Boundless. It reflects the core philosophy of the platform — no boundaries, no limits, no lock-in. Run anywhere. Use any AI. Own everything.

2. Vision
Build an open-source AI-native software development platform that enables developers and organizations to rapidly build software applications using AI while retaining complete ownership of their code, infrastructure and AI models.
Unlike existing AI application builders, the platform is designed around openness, extensibility and enterprise deployment.

The platform should run:
Locally
On-premises
Private cloud
Public cloud

...without changing the developer experience.

3. Mission
Enable every developer and every organization to build applications using AI without vendor lock-in.

The platform should make AI development:
Private
Secure
Extensible
Portable
Enterprise-ready

4. Problem Statement
Current AI application builders are primarily cloud-hosted products tied to specific providers.

Organizations often face several challenges:
Source code cannot leave enterprise networks.
AI provider choice is restricted.
Applications become tied to a single vendor.
Internal standards and reusable assets cannot easily be integrated.
Teams require governance, auditing and deployment flexibility.

Developers also use many disconnected tools during development. There is an opportunity to provide a unified AI-native development platform that runs wherever the customer chooses.

5. Target Users
Phase 1
Individual developers
AI enthusiasts
Open-source contributors
Students
Indie hackers

Phase 2
Small development teams
Startups
Consultancies

Phase 3
Enterprise development teams
Banks, Healthcare, Manufacturing, Government, Defense
Organizations requiring private AI infrastructure

6. Core Principles
Local First
Everything should work on a developer laptop.
Internet should not be mandatory.

Deployment Agnostic
Run anywhere: Laptop, VM, Docker, Kubernetes, Azure, AWS, GCP, Air-gapped environments

Model Agnostic
Support any AI provider: OpenAI, Claude, Gemini, Azure OpenAI, Bedrock, Vertex AI, OpenRouter, Ollama, LM Studio, vLLM, and future providers.

Framework Agnostic
Initial support: React, Vite, Next.js. Future: Angular, Vue, Flutter, React Native, Spring, .NET, Node.js, Python.

Generated Code Belongs To The User
Projects should remain standard source code.
No proprietary project format.
No lock-in.

Plugin First
Everything should be extensible: Models, Frameworks, Agents, Deployments, Templates, Themes, Internal enterprise plugins.

Privacy First
Customer decides where data is processed.
No mandatory cloud services.

Cost Transparency
Every token consumed is tracked and visible to the user.
Local model usage is tracked in tokens but shown as free.
Cloud model costs are calculated in real time per request.
Users and enterprises can set budget limits at any level.
No hidden consumption — the developer always knows what they are spending.

7. Competitor Analysis
VYOM does not have one direct competitor. It overlaps several markets.

Category 1 — AI Code Editors

Product
Strength
Weakness
Cursor
Excellent AI code editing experience
Cloud dependent, closed source, no local AI control
GitHub Copilot
Deeply integrated into VS Code
Microsoft/GitHub lock-in, no self-hosting
Windsurf
Clean agentic coding experience
Cloud only, closed source
Zed
Fast, modern editor with AI
Limited AI flexibility, no local deployment story

Category 2 — AI App Builders

Product
Strength
Weakness
Bolt.new
Incredibly fast to get started
StackBlitz cloud only, no self-hosting, limited models
Lovable
Great UX, fast prototyping
Fully cloud, proprietary, code ownership unclear
V0 (Vercel)
Beautiful UI generation
Vercel ecosystem lock-in, no local option
Replit
Collaborative, fast
Cloud only, proprietary runtime
StackBlitz
Browser-based dev environment
Cloud dependent, limited to web

Category 3 — Local AI Dev Tools

Product
Strength
Weakness
Ollama
Excellent local model running
Just a model runner, no dev environment
LM Studio
Great local model UI
Just a model manager, no coding platform
Jan.ai
Open source local AI
Chat focused, not a dev platform

Category 4 — Enterprise Dev Platforms

Product
Strength
Weakness
AWS CodeWhisperer
Deep AWS integration
AWS lock-in, enterprise only
Google Duet AI
GCP integrated
GCP lock-in, closed
Tabnine
Self-hostable, enterprise ready
Completion focused, not a full platform
Codeium
Fast, free tier
Limited enterprise control

The Gap VYOM Fills
Nobody owns the intersection of: full-featured AI development platform, self-hostable and open source, model agnostic, and enterprise ready.

VYOM's unique position: The only open-source AI development platform that gives developers and enterprises a full local-first experience with complete model and infrastructure freedom.

8. Product Positioning
The platform is not another AI chatbot. Not another IDE. Not simply an AI app builder. VYOM is an AI-native software development environment.

Think of it as:
Docker Desktop + VS Code + Gemini Studio + Git + AI
...under one extensible platform.

9. Long-Term Vision
Become the standard platform for AI-assisted software development.

Developers should be able to:
Use any AI
Build any application
Deploy anywhere
Own everything

10. Domain Model
The domain model defines the core concepts VYOM is built around. All platform decisions should map back to these entities.

Entity Overview

Entity
Description
Scope
Workspace
The root container for everything in VYOM
Global
Project
A single application being built
Per workspace
Session
One working period within a project
Per project
Message
A single AI conversation turn
Per session
TokenUsage
Token and cost record for one message
Per message
UsageSummary
Rolled-up usage at any scope level
Any level
ModelConfig
A configured AI provider and model
Per workspace
Plugin
An installable extension to the platform
Per workspace
Agent
An AI role with a specific purpose
Per workspace

Core Entity Structures
Workspace
Workspace├── id, name, owner, settings├── installed_plugins[]├── configured_models[]├── available_agents[]├── usage_summary└── projects[]

Project
Project├── id, name, description├── framework  (react | vue | angular | ...)├── created_at, updated_at, status├── files[], sessions[]└── usage_summary

Session
Session├── id, project_id, name├── started_at, ended_at├── messages[]└── usage_summary

Message
Message├── id, session_id├── role  (user | assistant | system)├── content, model_config_id, agent_id├── timestamp└── token_usage

TokenUsage
TokenUsage├── id, message_id, session_id, project_id├── provider, model├── input_tokens, output_tokens, total_tokens├── cost_usd  (0.00 for local)├── is_local└── timestamp

UsageSummary
UsageSummary├── scope  (session | project | workspace)├── scope_id├── total_input_tokens, total_output_tokens, total_tokens├── total_cost_usd├── local_tokens, cloud_tokens├── by_provider[]└── by_model[]

Entity Relationships
Workspace├── ModelConfig[], Plugin[], Agent[], UsageSummary└── Project[]    ├── UsageSummary    └── Session[]        ├── UsageSummary        └── Message[]            └── TokenUsage

11. Plugin Architecture
The plugin system is the core extensibility mechanism of VYOM. No modification to the VYOM core should ever be needed to add a new model, framework, deployment target or agent.

Golden Rule: If adding a new model, framework or deployment target requires modifying the VYOM core, the plugin architecture has failed.

Plugin Interfaces
Base Plugin Interface
interface VyomPlugin {  initialize(config): Promise<void>;  teardown(): Promise<void>;  healthCheck(): Promise<HealthStatus>;  getManifest(): PluginManifest;  getConfigSchema(): ConfigSchema;}

Model Plugin Interface
interface ModelPlugin extends VyomPlugin {  chat(request: ChatRequest): Promise<ChatResponse>;  stream(request: ChatRequest): AsyncIterator<ChatChunk>;  countTokens(text: string): Promise<number>;  estimateCost(inputTokens: number, outputTokens: number): CostEstimate;  getModelInfo(): ModelInfo;  listAvailableModels(): Promise<ModelDescriptor[]>;}

Framework Plugin Interface
interface FrameworkPlugin extends VyomPlugin {  createProject(options): Promise<ProjectScaffold>;  generateComponent(spec): Promise<GeneratedFile[]>;  generatePage(spec): Promise<GeneratedFile[]>;  startDevServer(project): Promise<DevServer>;  build(project): Promise<BuildResult>;  generateDockerfile(project): Promise<string>;}

Deployment & Agent Interfaces
interface DeploymentPlugin extends VyomPlugin {  deploy(project, config): Promise<DeployResult>;  generateDockerfile(project): Promise<string>;  generateComposeFile(project): Promise<string>;}interface AgentPlugin extends VyomPlugin {  execute(task: AgentTask): Promise<AgentResult>;  stream(task): AsyncIterator<AgentChunk>;  getCapabilities(): AgentCapability[];}

Plugin Language — Phased
Phase
Languages
Mechanism
Phase 1
TypeScript / JavaScript
Direct import
Phase 2
Python
Subprocess — JSON-RPC over stdio
Phase 3
Any language
RPC bridge — JSON-RPC over HTTP
Phase 4+
Community driven
Based on adoption

Distribution & Sandboxing
Primary distribution: npm  |  Naming: @vyom/plugin-name (official)  •  vyom-plugin-name (community)

Tier
Name
Mechanism
When
Tier 1
Trusted
Same process
Core built-in plugins only
Tier 2
Lightweight
Separate Node.js process
Default for community plugins
Tier 3
Full Sandbox
WASM / container
Enterprise and high security

Built-in MVP Plugins
Plugin
Type
Ships With
@vyom/plugin-openai
Model
Phase 1
@vyom/plugin-anthropic
Model
Phase 1
@vyom/plugin-ollama
Model
Phase 1
@vyom/plugin-react
Framework
Phase 1
@vyom/plugin-docker
Deployment
Phase 1
@vyom/plugin-gemini
Model
Phase 2
@vyom/plugin-vue
Framework
Phase 4
@vyom/plugin-kubernetes
Deployment
Phase 5

12. Model Abstraction Layer
The bridge between the VYOM engine and every AI provider. The engine speaks one language and never knows which provider is underneath.

Core principle: Adding a new AI provider requires zero changes to the engine — only a new plugin.

Four Core Components
ModelRouter
Entry point for all AI calls. Resolves the correct plugin and dispatches. The engine only ever calls the router.

TokenCounter
Counts tokens before a request is sent. Powers the live cost estimate shown before the user hits send.

CostEngine
Calculates and records actual cost after every response. Updates session and project summaries automatically.

StreamNormalizer
Every provider streams differently. Normalizes all streams into one unified chunk format.

Unified Request and Response
UnifiedChatRequest  →  messages[], model, options, metadataUnifiedChatResponse →  id, content, model, provider, finishReason,                        usage { inputTokens, outputTokens, costUsd, isLocal },                        latencyMs, timestamp

Request Flow
1. Engine → ModelRouter.chat(request)2. Router resolves model → finds correct ModelPlugin3. TokenCounter counts input tokens4. Plugin translates request → provider format5. Plugin calls provider API6. Plugin translates response → UnifiedChatResponse7. CostEngine records TokenUsage8. CostEngine updates Session + Project UsageSummary9. Engine receives UnifiedChatResponse — always same shape

Pricing Registry
Provider
Model
Input / 1M
Output / 1M
OpenAI
gpt-4o
$5.00
$15.00
OpenAI
gpt-4o-mini
$0.15
$0.60
Anthropic
claude-opus
$15.00
$75.00
Anthropic
claude-sonnet
$3.00
$15.00
Anthropic
claude-haiku
$0.25
$1.25
Google
gemini-1.5-pro
$3.50
$10.50
Local (Ollama / LM Studio)
any model
$0.00
$0.00

13. Platform Architecture
The platform architecture ties all layers together. The engine is the heart — every UI surface connects through the same API.

Full Architecture Overview
┌──────────────────────────────────────────────────────────┐│                      UI LAYER                            ││   Desktop Studio  │  Web Studio  │  VS Code  │  CLI      │└─────────────────────────┬────────────────────────────────┘                          │  REST API / IPC┌─────────────────────────▼────────────────────────────────┐│                    VYOM ENGINE                           ││   WorkspaceManager   ProjectManager   SessionManager     ││   ModelAbstraction   PluginRegistry   AgentRunner        ││   FileSystem         CostEngine       Event Bus          │└─────────────────────────┬────────────────────────────────┘                          │┌─────────────────────────▼────────────────────────────────┐│                   PLUGIN LAYER                           ││   Model Plugins  │  Framework Plugins  │  Deployment     │└─────────────────────────┬────────────────────────────────┘                          │┌─────────────────────────▼────────────────────────────────┐│               INFRASTRUCTURE LAYER                       ││   Local FS  │  SQLite  │  AI Providers  │  Dev Server    │└──────────────────────────────────────────────────────────┘

Engine Subsystems
Subsystem
Responsibility
WorkspaceManager
Root workspace, settings, installed plugins, configured models
ProjectManager
Project lifecycle — create, open, archive, export
SessionManager
AI working sessions, message history, context tracking
FileSystem
All file operations — local disk, in-memory, or network
ModelAbstraction
Routes all AI calls through unified interface
PluginRegistry
Discovers, loads, validates, sandboxes plugins
AgentRunner
Executes agent tasks and multi-step workflows
CostEngine
Token tracking, cost calculation, usage rollups
Event Bus
Internal nervous system — loose coupling between all subsystems

Technology Stack
Layer
Technology
Rationale
Engine
Node.js + TypeScript
Cross-platform, same language as plugins
Desktop shell
Tauri (preferred) or Electron
Tauri is lighter, Rust-based, more secure
Web UI
React + Vite + Tailwind
Matches the generated app tech stack
Editor
Monaco Editor
Same engine as VS Code, battle-tested
Database
SQLite (better-sqlite3)
Zero config, embedded, offline first
Dev preview
Vite dev server
Fast HMR, runs generated apps inline
API keys
OS keychain + encrypted file
Secure, never stored in plain text
Monorepo
Turborepo
Engine and plugins as independent packages

Monorepo Structure
vyom/├── packages/│   ├── engine/│   ├── ui-desktop/│   ├── ui-web/│   ├── ui-vscode/│   ├── cli/│   ├── plugin-sdk/│   └── plugins/│       ├── plugin-openai/│       ├── plugin-anthropic/│       ├── plugin-ollama/│       ├── plugin-react/│       └── plugin-docker/├── docs/├── examples/└── turbo.json

14. Product Requirements Document (PRD)
This PRD defines the requirements for the VYOM MVP — Phase 1. It is the specification a developer builds directly from.

14.1 Overview
Field
Value
Product
VYOM (व्योम)
Version
MVP — Phase 1
Status
Pre-development
Goal
Deliver a working local-first AI development platform for React/Vite SPAs
Target user
Solo developer / indie hacker
Success metric
A developer can go from zero to a running AI-generated React app in under 5 minutes

14.2 User Stories

Workspace Setup

ID
Story
US-001
As a developer, I want to open VYOM and have a workspace ready immediately, so I can start building without any configuration.
US-002
As a developer, I want to configure my AI provider (OpenAI, Anthropic, Ollama) in one place, so all projects use my preferred model automatically.
US-003
As a developer, I want to switch between AI models at any time, so I can choose the right model for the task or manage my costs.

Project Management

ID
Story
US-010
As a developer, I want to create a new React/Vite project with one click, so I can start building immediately without manual scaffolding.
US-011
As a developer, I want to see all my projects in one place, so I can quickly switch between them.
US-012
As a developer, I want to export my project as a standard zip file, so I can take my code anywhere without VYOM.

AI Chat and Code Generation

ID
Story
US-020
As a developer, I want to describe a component in plain English and have it generated instantly, so I can build faster without writing boilerplate.
US-021
As a developer, I want to ask VYOM to edit existing code by describing the change, so I don't have to manually find and modify files.
US-022
As a developer, I want to see the AI's response streaming in real time, so the experience feels fast and responsive.
US-023
As a developer, I want to see which files were created or modified after each AI response, so I always know what changed.
US-024
As a developer, I want the AI to retain the full conversation history within a session, so it has context for follow-up requests.

Live Preview

ID
Story
US-030
As a developer, I want to see a live preview of my app update instantly after code is generated, so I can verify output without switching tools.
US-031
As a developer, I want the preview to hot-reload when I manually edit a file, so I stay in a fast feedback loop.

File Management

ID
Story
US-040
As a developer, I want to browse my project files in a tree view, so I can understand the project structure at a glance.
US-041
As a developer, I want to open any file in the Monaco editor and edit it manually, so I always have full control over my code.
US-042
As a developer, I want a built-in terminal, so I can run commands without leaving VYOM.

Token and Cost Visibility

ID
Story
US-050
As a developer, I want to see the token count and estimated cost before I send a message, so I can make informed decisions.
US-051
As a developer, I want to see the actual tokens used and cost after each AI response, so I know exactly what each generation costs.
US-052
As a developer, I want to see the total token usage and cost for the current session, so I can track my spending in real time.
US-053
As a developer, I want to see cumulative usage across the whole project, so I understand my total investment.

Docker Export

ID
Story
US-060
As a developer, I want VYOM to generate a Dockerfile for my project automatically, so I can containerize it without writing Docker config.
US-061
As a developer, I want VYOM to generate a docker-compose.yml, so I can run my app in a container locally with one command.

14.3 Functional Requirements

FR-001 — Workspace
ID
Requirement
FR-001-01
System must initialize a workspace automatically on first launch
FR-001-02
System must persist workspace settings between sessions
FR-001-03
System must support configuring multiple AI model providers
FR-001-04
System must allow setting a default active model
FR-001-05
System must validate API keys on configuration and report errors clearly

FR-002 — Project Management
ID
Requirement
FR-002-01
System must scaffold a new React/Vite/Tailwind/TypeScript project in under 10 seconds
FR-002-02
System must list all projects with name, framework, created date and last modified
FR-002-03
System must open an existing project and restore last session context
FR-002-04
System must export a project as a standard zip containing only source code
FR-002-05
System must never include VYOM-specific files in the exported project

FR-003 — AI Chat
ID
Requirement
FR-003-01
System must send user messages to the configured AI model
FR-003-02
System must stream AI responses in real time
FR-003-03
System must parse generated code from AI responses and write to the correct files
FR-003-04
System must display which files were created or modified after each response
FR-003-05
System must maintain full message history within a session as context
FR-003-06
System must handle AI provider errors gracefully with clear user-facing messages
FR-003-07
System must support switching models between messages within a session

FR-004 — Code Generation
ID
Requirement
FR-004-01
System must generate React components as .tsx files in the correct project location
FR-004-02
System must generate full pages with routing awareness
FR-004-03
System must apply Tailwind classes for all styling in generated code
FR-004-04
System must edit existing files when the user requests a change to existing code
FR-004-05
Generated code must be valid TypeScript with no compilation errors

FR-005 — Live Preview
ID
Requirement
FR-005-01
System must start a Vite dev server for each open project
FR-005-02
System must display the running app in an embedded preview panel
FR-005-03
Preview must hot-reload within 1 second of any file change
FR-005-04
System must show build errors in the preview panel with clear messages

FR-006 — File Explorer and Editor
ID
Requirement
FR-006-01
System must display the project file tree in a sidebar
FR-006-02
System must open any file in the Monaco editor on click
FR-006-03
Monaco editor must support TypeScript, TSX, CSS, JSON with syntax highlighting
FR-006-04
Manual edits in Monaco must trigger live preview hot-reload
FR-006-05
System must provide an integrated terminal with shell access

FR-007 — Token and Cost Tracking
ID
Requirement
FR-007-01
System must count input tokens before each message is sent
FR-007-02
System must display estimated cost before the user sends a message
FR-007-03
System must record actual input tokens, output tokens and cost after each response
FR-007-04
System must display token usage and cost inline with each AI message
FR-007-05
System must display session total tokens and cost in the chat interface
FR-007-06
System must display project cumulative tokens and cost in the project dashboard
FR-007-07
Local model usage must show token count but always display $0.00 cost

FR-008 — Docker Export
ID
Requirement
FR-008-01
System must generate a production-ready Dockerfile for the project
FR-008-02
System must generate a docker-compose.yml for local container execution
FR-008-03
Generated Docker files must produce a working container with no manual edits

FR-009 — Plugin System
ID
Requirement
FR-009-01
System must load all plugins from the built-in plugin directory on startup
FR-009-02
System must validate each plugin against its manifest before loading
FR-009-03
System must report plugin load failures without crashing the application
FR-009-04
System must support installing additional plugins from npm

14.4 Non-Functional Requirements

Performance
ID
Requirement
NFR-001
Application must launch and be ready in under 5 seconds on a modern laptop
NFR-002
Project creation must complete in under 10 seconds
NFR-003
Live preview must hot-reload within 1 second of a file change
NFR-004
File tree must render projects with up to 500 files without lag
NFR-005
Token count estimate must appear within 200ms of the user typing

Reliability
ID
Requirement
NFR-006
Application must not crash on AI provider failure — show error, allow retry
NFR-007
All user data must be persisted to SQLite after every write operation
NFR-008
Application must recover to a working state on restart after an unexpected close

Security
ID
Requirement
NFR-009
API keys must never be stored in plain text
NFR-010
API keys must be stored in the OS keychain where available
NFR-011
API keys must never appear in log files or error messages
NFR-012
Plugin execution in Tier 2 must run in a separate process with no shared memory

Portability
ID
Requirement
NFR-013
Application must run on macOS, Windows and Linux
NFR-014
Generated project code must run without VYOM installed
NFR-015
Exported zip must be runnable with standard Node.js tools only

Offline
ID
Requirement
NFR-016
Application must launch and open existing projects with no internet connection
NFR-017
Ollama-based workflows must complete entirely offline

14.5 Technical Requirements
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

14.6 MVP Scope Summary
Feature
In MVP
Phase
Workspace setup
✅
1
Model configuration (OpenAI, Anthropic, Ollama)
✅
1
Create React/Vite/Tailwind/TypeScript project
✅
1
AI Chat with streaming
✅
1
Generate components and pages
✅
1
Edit existing code via AI
✅
1
Live preview with hot reload
✅
1
File explorer
✅
1
Monaco editor
✅
1
Integrated terminal
✅
1
Token and cost display
✅
1
Project export (zip)
✅
1
Dockerfile generation
✅
1
Docker Compose generation
✅
1
Authentication
❌
5
Multi-user workspaces
❌
5
Enterprise RBAC
❌
5
Budget limits
❌
5
Vue / Angular support
❌
4
Python plugin support
❌
2
Marketplace
❌
4

14.7 Acceptance Criteria
The MVP is complete when all of the following are true:

ID
Acceptance Criterion
AC-001
A developer with no prior VYOM experience can install the desktop app and create their first AI-generated React component in under 5 minutes
AC-002
The generated component renders correctly in the live preview without any manual fixes
AC-003
The developer can ask VYOM to modify the component and the change appears in the preview within 2 seconds of the AI response completing
AC-004
The developer can export the project and run it with npm install && npm run dev without VYOM installed
AC-005
Every AI interaction shows token count and cost — before and after sending
AC-006
The app works completely offline using Ollama with no internet connection required
AC-007
The generated Dockerfile produces a running container with docker build && docker run
AC-008
Closing and reopening the app restores all projects, sessions and chat history exactly
AC-009
An invalid API key shows a clear error message — the app does not crash
AC-010
All unit tests pass. Engine test coverage is at or above 70%

15. Initial Scope (MVP)
The first release intentionally has a narrow scope — fully defined in the PRD above.

Support
React
Vite
Tailwind
TypeScript
Single Page Applications

Capabilities
Create Project
AI Chat
Generate Components
Generate Pages
Edit Existing Code
Live Preview
File Explorer
Monaco Editor
Terminal
Dockerfile Generation
Docker Compose Generation
Project Export
Token Usage Display (per message and per session)

16. What Is Explicitly Out Of Scope
Enterprise Collaboration
Authentication
Marketplace / Agent Marketplace
Database Designer
CI/CD
Mobile Applications
Native Desktop Applications
Microservice Generation
Kubernetes Deployment
Multi-user Workspaces
Budget limits and enterprise cost governance (Phase 5)

These will come later.

17. Future Enterprise Features
RBAC
Organization Policies
Internal Templates
Internal Component Libraries
Audit Logs
Shared AI Memory
Model Governance
Cost Tracking and Budget Enforcement
Cost Reporting by Team and Project
Private Plugin Registry
Minimum Sandbox Tier Policy
PostgreSQL storage plugin

18. Differentiators

Differentiator
Description
Open Source
Full transparency, community contributions, no black box
Local First
Works completely offline on a developer laptop
Enterprise Ready
Self-hosting, governance, audit, RBAC from day one
Private & Secure
Customer decides where data is processed
Bring Your Own Model
OpenAI, Claude, Ollama, Gemini — any model
Bring Your Own Infrastructure
Laptop, VM, Docker, Kubernetes, any cloud
Plugin Architecture
Extensible core, community and enterprise plugins
Portable Projects
Standard source code, no proprietary format
Code Ownership
Everything generated belongs to the developer
Cost Transparency
Every token tracked, every cost visible, no surprises

19. Success Criteria
Developers enjoy using the platform.
Projects remain portable.
Organizations can self-host.
New AI providers can be added without modifying the core.
New frameworks can be added without modifying the core.
Community contributions become possible.
Developers always know exactly how many tokens they have consumed and what it cost.

20. Guiding Philosophy
AI should act as a development teammate, not replace the developer.
The platform should always keep the human developer in control.
The platform should accelerate software development while maintaining transparency, ownership and flexibility.

Design Principle: "Will this make it easier for others to extend the platform in the future?" If the answer is no, reconsider the design.

21. Roadmap

Phase
Name
Key Deliverables
Phase 0
Discovery
Vision, Competitor Analysis, Domain Model, Plugin Architecture, Model Abstraction, Platform Architecture, PRD
Phase 1
Core Platform
Workspace Engine, Project Model, Plugin SDK, Model Abstraction Layer, CLI, Desktop Studio MVP
Phase 2
Developer Experience
AI Chat, Live Preview, Monaco Editor, Token Dashboard, Python Plugin Support
Phase 3
SPA Development
React, Vite, Tailwind, Docker Export, Project Templates
Phase 4
Extensibility
Framework Plugins, Deployment Plugins, Agent Plugins, Marketplace UI, Multi-language RPC
Phase 5
Enterprise
RBAC, Web Studio, Self-hosting, Audit, Governance, Cost Enforcement, Private Registry
Phase 6
Ecosystem
Marketplace, Community Plugins, Enterprise Plugins, Cloud Offerings, Agent Marketplace

22. Immediate Next Actions
✅  Project name finalized: VYOM (व्योम)
✅  One-sentence vision defined
✅  Competitor analysis completed
✅  Domain model defined
✅  Cost transparency principle defined
✅  Plugin architecture designed
✅  Model abstraction layer designed
✅  Overall platform architecture designed
✅  Product Requirements Document (PRD) completed
Design the user experience
Create GitHub organization and repository
Publish documentation before implementation begins
Begin Phase 1 — Core Platform implementation

No production code should be written until the product vision and architecture are agreed upon.

VYOM (व्योम)  •  Version 0.7  •  Build Once. Run Anywhere. Use Any AI. Own Everything.