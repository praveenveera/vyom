VYOM
व्योम
Architecture Document
Version 1.0  •  Phase 0  •  Pre-development

Core design principle: "Will this make it easier for others to extend the platform in the future?" If the answer is no, reconsider the design.

1. Domain Model
The domain model defines the core concepts VYOM is built around. All platform decisions should map back to these entities.

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

Entity Structures
Workspace
Workspace├── id, name, owner, settings├── installed_plugins[]├── configured_models[]├── available_agents[]├── usage_summary└── projects[]

Project
Project├── id, name, description├── framework  (react | vue | angular | ...)├── created_at, updated_at, status├── files[], sessions[]└── usage_summary

Session
Session├── id, project_id, name├── started_at, ended_at├── messages[]└── usage_summary

Message
Message├── id, session_id├── role  (user | assistant | system)├── content, model_config_id, agent_id├── timestamp└── token_usage

TokenUsage
TokenUsage├── id, message_id, session_id, project_id├── provider, model├── input_tokens, output_tokens, total_tokens├── cost_usd  (0.00 for local), is_local└── timestamp

UsageSummary
UsageSummary├── scope  (session | project | workspace)├── scope_id├── total_input_tokens, total_output_tokens, total_tokens├── total_cost_usd├── local_tokens  (free), cloud_tokens  (paid)├── by_provider[]└── by_model[]

Entity Relationships
Workspace├── ModelConfig[], Plugin[], Agent[], UsageSummary└── Project[]    ├── UsageSummary    └── Session[]        ├── UsageSummary        └── Message[]            └── TokenUsage

2. Platform Architecture
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

The Event Bus
The Event Bus is the only mechanism for inter-subsystem communication. Subsystems never call each other directly.

// What we avoidSessionManager → CostEngine.record()    ❌// What we useSessionManager.emit('message.created')  ✅  → CostEngine listens → records usage  → FileSystem listens → persists message  → UI layer listens  → updates display

Technology Stack
Layer
Technology
Rationale
Engine
Node.js + TypeScript
Cross-platform, same language as plugins
Desktop shell
Tauri (preferred) or Electron
Lighter, Rust-based, more secure
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
Monorepo
Turborepo
Engine and plugins as independent packages

Deployment Topologies
Local Desktop (Phase 1)
Desktop App (Tauri) → VYOM Engine → SQLite + Local FS                    → AI Providers (local or cloud)

Self-hosted Server (Phase 5)
Web Studio (Browser) → REST API → VYOM Engine → SQLite / PostgreSQL                                  → AI Providers (local or cloud)

Air-gapped Enterprise (Phase 5)
Web Studio (Browser) → REST API (internal only) → VYOM Engine                                                  → Local AI only (Ollama / vLLM)

Monorepo Structure
vyom/├── packages/│   ├── engine/│   ├── ui-desktop/  (Tauri + React)│   ├── ui-web/      (React SPA)│   ├── ui-vscode/   (VS Code extension)│   ├── cli/│   ├── plugin-sdk/│   └── plugins/│       ├── plugin-openai/│       ├── plugin-anthropic/│       ├── plugin-ollama/│       ├── plugin-react/│       └── plugin-docker/├── docs/├── examples/└── turbo.json

3. Plugin Architecture
Golden Rule: If adding a new model, framework or deployment target requires modifying the VYOM core, the plugin architecture has failed.

Plugin Types
Type
Purpose
MVP Example
Model Plugin
Connect to an AI provider
@vyom/plugin-openai
Framework Plugin
Support a frontend framework
@vyom/plugin-react
Deployment Plugin
Package and deploy projects
@vyom/plugin-docker
Agent Plugin
Add a specialised AI role
Code reviewer, test writer
Enterprise Plugin
Add org-level features
SSO, audit logs, RBAC

Plugin Interfaces
Base
interface VyomPlugin {  initialize(config: PluginConfig): Promise<void>;  teardown(): Promise<void>;  healthCheck(): Promise<HealthStatus>;  getManifest(): PluginManifest;  getConfigSchema(): ConfigSchema;}

Model Plugin
interface ModelPlugin extends VyomPlugin {  chat(request: ChatRequest): Promise<ChatResponse>;  stream(request: ChatRequest): AsyncIterator<ChatChunk>;  countTokens(text: string): Promise<number>;  estimateCost(inputTokens: number, outputTokens: number): CostEstimate;  getModelInfo(): ModelInfo;  listAvailableModels(): Promise<ModelDescriptor[]>;}

Framework Plugin
interface FrameworkPlugin extends VyomPlugin {  createProject(options: ProjectOptions): Promise<ProjectScaffold>;  generateComponent(spec: ComponentSpec): Promise<GeneratedFile[]>;  generatePage(spec: PageSpec): Promise<GeneratedFile[]>;  startDevServer(project: Project): Promise<DevServer>;  build(project: Project): Promise<BuildResult>;  generateDockerfile(project: Project): Promise<string>;}

Deployment Plugin
interface DeploymentPlugin extends VyomPlugin {  deploy(project: Project, config: DeployConfig): Promise<DeployResult>;  generateDockerfile(project: Project): Promise<string>;  generateComposeFile(project: Project): Promise<string>;}

Agent Plugin
interface AgentPlugin extends VyomPlugin {  execute(task: AgentTask): Promise<AgentResult>;  stream(task: AgentTask): AsyncIterator<AgentChunk>;  getCapabilities(): AgentCapability[];}

Plugin Language Support — Phased
Phase
Language
Mechanism
Phase 1
TypeScript / JavaScript
Direct import — same Node.js runtime
Phase 2
Python
Subprocess — JSON-RPC over stdio
Phase 3
Any language
RPC bridge — JSON-RPC over HTTP
Phase 4+
Community driven
Based on adoption

Plugin Distribution
Primary: npm  |  @vyom/plugin-name (official)  •  vyom-plugin-name (community)  •  @org/vyom-plugin-name (enterprise)

Plugin Sandboxing
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
Separate Node.js process + IPC
Default for community plugins
Tier 3
Full Sandbox
WASM / container
Enterprise and high security

Built-in MVP Plugins
Plugin
Type
Phase
@vyom/plugin-openai
Model
1
@vyom/plugin-anthropic
Model
1
@vyom/plugin-ollama
Model
1
@vyom/plugin-react
Framework
1
@vyom/plugin-docker
Deployment
1
@vyom/plugin-gemini
Model
2
@vyom/plugin-vue
Framework
4
@vyom/plugin-kubernetes
Deployment
5

4. Model Abstraction Layer
Core principle: The engine calls one interface. The abstraction layer handles all provider translation. Adding a new AI provider requires zero changes to the engine.

Architecture
VYOM Engine  →  ModelRouter  →  TokenCounter                             →  CostEngine                             →  StreamNormalizer                             →  PricingRegistry             →  OpenAI Plugin | Anthropic Plugin | Ollama Plugin

Unified Contracts
UnifiedChatRequest  →  messages[], model, options, metadataUnifiedChatResponse →  id, content, model, provider, finishReason,                        usage { inputTokens, outputTokens, costUsd, isLocal },                        latencyMs, timestamp

Four Core Components
Component
Responsibility
ModelRouter
Entry point. Resolves the correct plugin and dispatches. Engine only ever calls the router.
TokenCounter
Counts tokens before sending. Powers the live cost estimate shown before the user hits send.
CostEngine
Calculates and records actual cost after every response. Updates session and project summaries.
StreamNormalizer
Every provider streams differently. Normalizes all into one unified chunk format.

Request Flow
1. Engine → ModelRouter.chat(request)2. Router resolves plugin3. TokenCounter counts input tokens4. Plugin translates request → provider format5. Plugin calls provider API6. Plugin translates response → UnifiedChatResponse7. CostEngine records TokenUsage8. CostEngine updates Session + Project UsageSummary9. Engine receives UnifiedChatResponse — always same shape

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
Local (Ollama / LM Studio / vLLM)
any model
$0.00
$0.00

5. UX Architecture

The Five Screens
Screen
Purpose
When
Welcome / Setup
Configure first AI model
First launch only
Project Dashboard
Home — all projects at a glance
Every launch after setup
Studio
Main working environment
When a project is open
Settings
Models, plugins, preferences
On demand
Usage Dashboard
Token and cost overview
On demand

Studio Layout — Three Columns
Column
Width
Content
Files
~18%
File tree — click any file to open in Monaco editor
AI Chat / Editor
~42%
Conversation, file changes, token display, Monaco editor tab
Preview + Terminal
~40%
Live Vite preview above, integrated terminal below

Core User Flow
Install → Configure model → Create project → Studio opens  → Type in chat → AI generates → Preview updates  → Modify via chat → Export when done  Total time from install to first working component: < 5 minutes

VYOM (व्योम)  •  Architecture Document v1.0  •  Build Once. Run Anywhere. Use Any AI. Own Everything.