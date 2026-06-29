<div align="center">

# GarageBuild — व्योम

### *Infinite Space · Sky · Universe · Boundless*

**The open-source AI development platform that runs anywhere, uses any AI, and keeps you in complete control.**

[![License: MIT](https://img.shields.io/badge/License-MIT-4F46E5.svg)](LICENSE)
[![Status: Alpha](https://img.shields.io/badge/Status-Alpha%20%C2%B7%20Phase%201%20Complete-6366F1.svg)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-A5B4FC.svg)]()

*Build Once. Run Anywhere. Use Any AI. Own Everything.*

</div>

---

## AI is temporary. Software is permanent.

Today's best model will not be tomorrow's best model. Technology changes. Pricing changes. APIs change. Providers come and go.

But the software you build may live for years. It will outlast every model that helped create it.

**GarageBuild is never built around today's AI. It is built around software.**

---

## Why GarageBuild Exists

Over the past year, I spent time with ChatGPT, Claude, Gemini, LM Studio, Ollama, Cursor, and a dozen enterprise AI platforms.

Almost every session led back to the same question:

> *"Why can't these tools work together while letting me stay in control?"*

Today's AI development landscape is fragmented.

One tool writes code. Another previews apps. Another runs local models. Another deploys. Another locks you into its cloud.

Instead of one development environment, developers stitch together a dozen disconnected products — and give up ownership, privacy and flexibility along the way.

**GarageBuild exists to fix that.**

---

## What GarageBuild Is

GarageBuild is an open-source, local-first AI development platform.

- **Not** another AI chatbot
- **Not** another IDE
- **Not** another cloud app builder

Think of it as:

```
Docker Desktop + VS Code + Gemini Studio + Git + AI
```

...under one open, extensible platform that you own completely.

---

## What We Believe

### AI Providers Are Plugins — Not The Platform

In GarageBuild, AI providers are plugins. They can be swapped, combined, upgraded or replaced without touching a single line of your project. Use OpenAI today. Switch to Claude tomorrow. Run Llama locally on Friday. Your workflow doesn't change.

### Developers Should Own Their Work

Everything GarageBuild generates is standard source code. No proprietary format. No lock-in. No strings attached. Export your project anytime and run it without GarageBuild installed — it always will.

### AI Should Run Where You Need It

Sometimes that's your laptop. Sometimes it's your company datacenter. Sometimes it's an air-gapped server with no internet connection. **The software adapts. The developer doesn't.**

### Software Development Is A Craft

Software is not merely generated. It is designed, refined, reviewed, tested and improved. AI should amplify that craft — not replace it. **The developer remains the architect. AI becomes the collaborator.**

### Platforms Should Be Open

Git survived every IDE. Docker survived every container runtime. Linux survived every commercial OS. They survived because they were open, extensible and independent of any single vendor. **GarageBuild is being built around openness — not today's AI models.**

---

## Core Principles

| Principle | What It Means |
|-----------|--------------|
| **Local First** | Everything works on a developer laptop. Internet is never mandatory. |
| **Model Agnostic** | Any AI: OpenAI, Claude, Gemini, Ollama, vLLM, anything future. |
| **Deployment Agnostic** | Run anywhere: laptop, VM, Docker, Kubernetes, any cloud, air-gapped. |
| **Framework Agnostic** | React today. Vue, Angular, Flutter, Spring tomorrow. |
| **Code Ownership** | Standard source code. No proprietary format. No lock-in. Ever. |
| **Plugin First** | Everything is extensible: models, frameworks, agents, deployments. |
| **Privacy First** | You decide where data is processed. No mandatory cloud services. |
| **Cost Transparency** | Every token tracked, every cost visible, no hidden consumption. |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     UI LAYER                            │
│  Desktop (Tauri)  │  Web SPA  │  VS Code  │  CLI       │
└──────────────────────────┬──────────────────────────────┘
                           │  REST API (Fastify)
┌──────────────────────────▼──────────────────────────────┐
│                    GarageBuild SERVER                          │
│  Workspace · Projects · Sessions · Agent · Plugins      │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                    GarageBuild ENGINE                          │
│  WorkspaceManager  ProjectManager  SessionManager       │
│  ModelRouter       PluginRegistry  AgentRunner          │
│  FileSystem        CostEngine      EventBus             │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                   PLUGIN LAYER                          │
│  Model Plugins  │  Framework Plugins  │  Deployment     │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│               INFRASTRUCTURE LAYER                      │
│  Local FS  │  SQLite  │  AI Providers  │  Dev Server   │
└─────────────────────────────────────────────────────────┘
```

**Golden Rule:** If adding a new AI provider requires modifying the GarageBuild core, the architecture has failed.

---

## Getting Started

**Prerequisites:** Node.js ≥ 20, npm ≥ 10

```bash
# Clone and install
git clone https://github.com/garagebuild/garagebuild.git
cd garagebuild
npm install

# Build all packages
npm run build

# Run all tests
npm test

# Use the CLI
node packages/cli/dist/cli.js --help
node packages/cli/dist/cli.js status
node packages/cli/dist/cli.js model add --provider openai --model gpt-4o --key sk-...
node packages/cli/dist/cli.js create my-project --framework react
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Engine | Node.js + TypeScript + SQLite (better-sqlite3) |
| REST API | Fastify |
| Desktop | Tauri 2 + React |
| Web UI | React + Vite |
| VS Code | VS Code Extension API |
| CLI | Commander.js |
| Monorepo | Turborepo |
| Testing | Jest (Node packages) · vitest (UI packages) |

---

## Project Structure

```
garagebuild/
├── packages/
│   ├── engine/           ← Core engine (10 subsystems, SQLite)
│   ├── server/           ← Fastify REST API server
│   ├── cli/              ← Commander.js CLI
│   ├── plugin-sdk/       ← Interfaces and types for plugin authors
│   ├── plugins/
│   │   ├── plugin-openai/    ← OpenAI model plugin (GPT-4o, o1, ...)
│   │   ├── plugin-anthropic/ ← Anthropic model plugin (Claude)
│   │   ├── plugin-ollama/    ← Ollama local model plugin
│   │   ├── plugin-react/     ← React framework plugin
│   │   └── plugin-docker/    ← Docker deployment plugin
│   ├── ui-desktop/       ← Tauri 2 desktop application
│   ├── ui-web/           ← React SPA
│   └── ui-vscode/        ← VS Code extension
├── docs/
│   ├── manifesto.md
│   ├── adr/              ← Architecture Decision Records
│   ├── project/          ← Full architecture and engineering docs
│   └── rfcs/             ← Requests for Comment
└── turbo.json
```

---

## Implementation Status

### Phase 1 — Core Platform

| Package | Status | Tests | Notes |
|---------|--------|-------|-------|
| `engine` | ✅ Complete | 10 subsystems | EventBus, WorkspaceManager, ProjectManager, SessionManager, CostEngine, PluginRegistry, ModelRouter, AgentRunner, FileSystem, GarageBuildEngine |
| `plugin-sdk` | ✅ Complete | types only | Full interface definitions: GarageBuildPlugin, ModelPlugin, FrameworkPlugin, DeploymentPlugin, AgentPlugin |
| `server` | ✅ Complete | 40 tests | Fastify REST API — workspace, projects, sessions, agent SSE, plugins |
| `cli` | ✅ Complete | ✅ | status, model, create, cost commands |
| `plugins/plugin-openai` | ✅ Complete | ✅ | GPT-4o, GPT-4, o1, streaming, cost tracking |
| `plugins/plugin-react` | ✅ Complete | ✅ | Scaffold, templates, Dockerfile generation |
| `plugins/plugin-docker` | ✅ Complete | 24 tests | Build, run, stop, inspect via injected spawner |
| `plugins/plugin-anthropic` | ✅ Complete | 39 tests | Claude 3.5/3 Opus/Sonnet/Haiku, SSE streaming, cost tracking |
| `plugins/plugin-ollama` | ✅ Complete | 26 tests | Local models via Ollama, dynamic model discovery, zero cost |
| `ui-web` | ✅ Complete | 17 tests | React SPA with Dashboard, Projects, Models pages |
| `ui-vscode` | ✅ Complete | 12 tests | Commands, status bar, REST API client |
| `ui-desktop` | ✅ Complete | 10 tests | Tauri 2 + React, embedded server management |

---

## Roadmap

| Phase | Name | Status |
|-------|------|--------|
| Phase 0 | Discovery — Vision, Architecture, PRD, UX | ✅ Complete |
| Phase 1 | Core Platform — Engine, Plugin SDK, CLI, REST API, UI shells | ✅ Complete |
| Phase 2 | Developer Experience — AI Chat, Live Preview, Token Dashboard | 🔄 Next |
| Phase 3 | SPA Development — React generation, Docker export, file editor | ⏳ Planned |
| Phase 4 | Extensibility — More frameworks, Plugin marketplace | ⏳ Planned |
| Phase 5 | Enterprise — RBAC, Self-hosting, Governance | ⏳ Planned |
| Phase 6 | Ecosystem — Community plugins, Cloud offerings | ⏳ Planned |

---

## Contributing

GarageBuild is built in public. Contributions, ideas and feedback are welcome.

- Read the [Engineering Document](docs/project/GarageBuild_Engineering_Document_v1.0.md) before contributing
- Significant changes require an [RFC](docs/rfcs/)
- All architectural decisions are recorded as [ADRs](docs/adr/)
- Plugins are distributed via npm: `@garagebuild/plugin-name` (official) · `garagebuild-plugin-name` (community)

---

## Documentation

| Document | Purpose |
|----------|---------|
| [Manifesto](docs/manifesto.md) | Why GarageBuild exists. Philosophy. Core beliefs. |
| [Architecture Document](docs/project/GarageBuild_Architecture_Document_v1.0.md) | Domain model, engine design, plugin SDK, model abstraction. |
| [Engineering Document](docs/project/GarageBuild_Engineering_Document_v1.0.md) | Standards, ADRs, RFCs, governance, contribution guide. |
| [Product Document](docs/project/GarageBuild_Product_Document_v1.0.md) | Problem, personas, MVP definition, roadmap. |

---

## License

MIT — free to use, modify and distribute.

---

<div align="center">

**GarageBuild (व्योम)**

*Open. Local. Extensible. Private. Developer-first.*

**Build Once. Run Anywhere. Use Any AI. Own Everything.**

</div>
