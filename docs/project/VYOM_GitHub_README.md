<div align="center">

# VYOM — व्योम

### *Infinite Space · Sky · Universe · Boundless*

**The open-source AI development platform that runs anywhere, uses any AI, and keeps you in complete control.**

[![License: MIT](https://img.shields.io/badge/License-MIT-4F46E5.svg)](LICENSE)
[![Status: Pre-development](https://img.shields.io/badge/Status-Pre--development-6366F1.svg)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-A5B4FC.svg)]()

*Build Once. Run Anywhere. Use Any AI. Own Everything.*

</div>

---

## AI is temporary. Software is permanent.

Today's best model will not be tomorrow's best model. Technology changes. Pricing changes. APIs change. Providers come and go.

But the software you build may live for years. It will outlast every model that helped create it.

**VYOM is never built around today's AI. It is built around software.**

---

## Why VYOM Exists

Over the past year, I spent time with ChatGPT, Claude, Gemini, LM Studio, Ollama, Cursor, and a dozen enterprise AI platforms.

Almost every session led back to the same question:

> *"Why can't these tools work together while letting me stay in control?"*

Today's AI development landscape is fragmented.

One tool writes code. Another previews apps. Another runs local models. Another deploys. Another locks you into its cloud.

Instead of one development environment, developers stitch together a dozen disconnected products — and give up ownership, privacy and flexibility along the way.

**VYOM exists to fix that.**

---

## What VYOM Is

VYOM is an open-source, local-first AI development platform.

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

In VYOM, AI providers are plugins. They can be swapped, combined, upgraded or replaced without touching a single line of your project. Use OpenAI today. Switch to Claude tomorrow. Run Llama locally on Friday. Your workflow doesn't change.

### Developers Should Own Their Work

Everything VYOM generates is standard source code. No proprietary format. No lock-in. No strings attached. Export your project anytime and run it without VYOM installed — it always will.

### AI Should Run Where You Need It

Sometimes that's your laptop. Sometimes it's your company datacenter. Sometimes it's an air-gapped server with no internet connection. **The software adapts. The developer doesn't.**

### Software Development Is A Craft

Software is not merely generated. It is designed, refined, reviewed, tested and improved. AI should amplify that craft — not replace it. **The developer remains the architect. AI becomes the collaborator.**

### Platforms Should Be Open

Git survived every IDE. Docker survived every container runtime. Linux survived every commercial OS. They survived because they were open, extensible and independent of any single vendor. **VYOM is being built around openness — not today's AI models.**

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

## MVP — What We're Building First

The first release is intentionally narrow. One user. One framework. One core loop.

**Target:** Solo developer / indie hacker  
**Success metric:** Zero to running AI-generated React app in under 5 minutes

### Supported stack
- React + Vite + Tailwind + TypeScript
- Single Page Applications

### Core capabilities
- **Workspace** — automatic setup, model configuration
- **AI Chat** — streaming conversation with any configured model
- **Code Generation** — generate React components and pages from plain English
- **Live Preview** — Vite dev server embedded, hot reload on every change
- **File Explorer** — project tree with Monaco editor
- **Terminal** — integrated shell
- **Token Display** — cost estimate before sending, actual cost after every response
- **Project Export** — standard zip, runs with `npm install` without VYOM
- **Docker Export** — Dockerfile and docker-compose.yml generated automatically

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     UI LAYER                            │
│  Desktop Studio  │  Web Studio  │  VS Code  │  CLI     │
└──────────────────────────┬──────────────────────────────┘
                           │  REST API / IPC
┌──────────────────────────▼──────────────────────────────┐
│                    VYOM ENGINE                          │
│  WorkspaceManager  ProjectManager  SessionManager       │
│  ModelAbstraction  PluginRegistry  AgentRunner          │
│  FileSystem        CostEngine      Event Bus            │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                   PLUGIN LAYER                          │
│  Model Plugins  │  Framework Plugins  │  Deployment    │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│               INFRASTRUCTURE LAYER                      │
│  Local FS  │  SQLite  │  AI Providers  │  Dev Server   │
└─────────────────────────────────────────────────────────┘
```

**Golden Rule:** If adding a new AI provider requires modifying the VYOM core, the architecture has failed.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Engine | Node.js + TypeScript |
| Desktop | Tauri (preferred) or Electron |
| UI | React + Vite + Tailwind |
| Editor | Monaco Editor |
| Database | SQLite (better-sqlite3) |
| Monorepo | Turborepo |

---

## Project Structure

```
vyom/
├── packages/
│   ├── engine/           ← core engine
│   ├── ui-desktop/       ← Desktop Studio
│   ├── ui-web/           ← Web Studio
│   ├── ui-vscode/        ← VS Code extension
│   ├── cli/              ← VYOM CLI
│   ├── plugin-sdk/       ← SDK for plugin authors
│   └── plugins/
│       ├── plugin-openai/
│       ├── plugin-anthropic/
│       ├── plugin-ollama/
│       ├── plugin-react/
│       └── plugin-docker/
├── docs/
│   ├── manifesto.md
│   ├── product.md
│   ├── architecture.md
│   ├── engineering.md
│   ├── adr/
│   └── rfcs/
└── turbo.json
```

---

## Roadmap

| Phase | Name | Status |
|-------|------|--------|
| Phase 0 | Discovery — Vision, Architecture, PRD, UX | ✅ Complete |
| Phase 1 | Core Platform — Engine, Plugin SDK, CLI, Desktop MVP | 🔄 Next |
| Phase 2 | Developer Experience — AI Chat, Preview, Token Dashboard | ⏳ Planned |
| Phase 3 | SPA Development — React, Vite, Docker Export | ⏳ Planned |
| Phase 4 | Extensibility — More frameworks, Marketplace | ⏳ Planned |
| Phase 5 | Enterprise — RBAC, Self-hosting, Governance | ⏳ Planned |
| Phase 6 | Ecosystem — Community plugins, Cloud offerings | ⏳ Planned |

---

## Contributing

VYOM is built in public. Contributions, ideas and feedback are welcome.

- Read the [Engineering Document](docs/engineering.md) before contributing
- Significant changes require an [RFC](docs/rfcs/)
- All architectural decisions are recorded as [ADRs](docs/adr/)
- Plugins are distributed via npm: `@vyom/plugin-name` (official) · `vyom-plugin-name` (community)

---

## Documentation

| Document | Purpose |
|----------|---------|
| [Manifesto](docs/manifesto.md) | Why VYOM exists. Philosophy. Core beliefs. |
| [Product Document](docs/product.md) | Problem, personas, MVP, PRD, roadmap. |
| [Architecture Document](docs/architecture.md) | Domain model, engine, plugin SDK, model abstraction. |
| [Engineering Document](docs/engineering.md) | Standards, ADRs, RFCs, governance, contribution guide. |

---

## License

MIT — free to use, modify and distribute.

---

<div align="center">

**VYOM (व्योम)**

*Open. Local. Extensible. Private. Developer-first.*

**Build Once. Run Anywhere. Use Any AI. Own Everything.**

</div>
