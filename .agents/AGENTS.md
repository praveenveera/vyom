# GarageBuild Workspace Rules & Architecture Guidelines

This file defines the project-scoped workflows, quality standards, and architectural rules for the GarageBuild platform codebase. Any agent working in this workspace must follow these rules.

---

## 📂 Codebase Layout
GarageBuild is structured as a monorepo using Turborepo:
- `packages/engine/` - Core platform engine (Node.js + TypeScript + SQLite):
  - EventBus (`event-bus/event-bus.ts`)
  - WorkspaceManager & DB schema (`workspace-manager/workspace-manager.ts` / `database.ts`)
  - ProjectManager (`project-manager/project-manager.ts`)
  - SessionManager (`session-manager/session-manager.ts`)
  - CostEngine (`cost-engine/cost-engine.ts`)
  - PluginRegistry (`plugin-registry/plugin-registry.ts`)
  - ModelRouter (`model-router/model-router.ts`)
  - AgentRunner & Built-in Agents (`agent-runner/agent-runner.ts` / `built-in-agents.ts`)
  - FileSystem (`file-system/file-system.ts`)
- `packages/plugin-sdk/` - Shared plugin interfaces and types.
- `packages/plugins/` - Target provider integrations (e.g. `plugin-ollama`, `plugin-openai`, `plugin-docker`).
- `packages/cli/` - Commander.js command-line interface.
- `packages/server/` - Fastify REST API server.
- `packages/ui-web/` - React SPA dashboard.
- `packages/ui-desktop/` - Tauri 2 React shell.
- `packages/ui-vscode/` - VS Code integration extension.

---

## 🛡️ Core Architecture Rules

### 1. The Decoupled Event Bus Rule (CRITICAL)
- **Subsystems must never call each other directly.** All inter-subsystem communication is strictly decoupled and transits through the central Event Bus.
  - *Incorrect:* `sessionManager.recordAssistantMessage(...)` calling `costEngine.recordUsage(...)` directly.
  - *Correct:* `sessionManager` completes message processing, emits a `message.completed` event on the Event Bus, and `CostEngine` listens and records usage asynchronously.

### 2. SQLite Database Connections
- All managers share a single SQLite connection provided via `workspaceManager.getDb()`. Never open parallel database connections to the same file.

### 3. Plugin Conventions
- Plugin manifest `id` must equal the provider/framework name (e.g. `'openai'`, `'react'`). This acts as the key for model resolution.
- All plugin interfaces must be defined in `packages/plugin-sdk/src/interfaces.ts`.

---

## ✍️ Coding & TypeScript Standards
- **TS Configurations:** Enforce strict TS rules (`NodeNext` modules, `exactOptionalPropertyTypes: true`).
- **Imports:** Use `import type` for type-only imports to prevent module dependency bloating.
- **Optional Fields:** Never pass `undefined` to optional fields that use `?:`. Spread the property instead:
  ```typescript
  // Correct property injection
  ...(val !== undefined && { key: val })
  ```

---

## 🧪 Testing Standards
- **Placement:** Test files must live adjacent to their implementation file (e.g., `foo.test.ts` beside `foo.ts`).
- **Database Isolation:** Each test run must use its own isolated, unique SQLite file:
  ```typescript
  const testDbPath = join(tmpdir(), 'garagebuild-test-' + randomUUID() + '.db');
  ```
- **Prerequisite Seeding:** Always seed foreign key requirements (Workspace $\rightarrow$ Project $\rightarrow$ Session $\rightarrow$ Message) before testing child table updates.
- **Bus Cleanup:** Call `eventBus.removeAllListeners()` in `beforeEach` to prevent event handler leaks across tests.

---

## ✍️ Documentation & Tone Standards

When writing user-facing docs, CLI help text, or comments, follow the brand profile (`praveen.builds`) guidelines:

### 1. The Simplification Analogy Rule
Explain complex architectural bottlenecks using simple physical analogies:
- **VRAM swap limits:** *The Kitchen Counter Analogy* (VRAM = counter, RAM = pantry).
- **JSON parsing loops:** *The Envelope Analogy* (JSON = fragile forms, XML = bright red envelope).
- **Context window limits:** *The Whiteboard Analogy* (context window = whiteboard needing top-line erasures).
- **Central gateway routing:** *Reflexes vs. Consultants Analogy* (local autocomplete = reflexes, cloud VPC reasoning = specialist consultants).

### 2. De-AI Verification Checklist
- **No Preambles or Summaries:** Avoid introductory fluff (*In today's fast-paced digital landscape*) and transition tags (*In conclusion*, *In summary*).
- **Abolish LLM Transitions:** Ban transition words like *furthermore*, *moreover*, *consequently*, *therefore*, and *on the other hand*.
- **Restrict Em-Dash (`—`) Usage:** Ban nested em-dashes used for parenthetical explanations. Use standard parentheses `()`, colons `:`, or commas `,` instead.
- **H1 Title Redundancy:** Ensure markdown files do not repeat the title header in the body if it is already present in frontmatter metadata.
- **Ground in Quantitative Systems Data:** Every technical assertion must be backed by a quantitative metric (VRAM footprint, memory bandwidth, latency, or throughput rates).

### 3. Formatting & Markdown Compatibility
- **Table-First Presentation:** Present comparative metrics, hardware recommendations, and config parameters in Markdown tables rather than bulleted lists to maximize readability.
- **No Raw Mermaid or GitHub Alerts:** Standard Mermaid blocks and GitHub alert syntax (`> [!TIP]`) break on external publishing channels. Replace with ASCII/Unicode trees for diagrams and emoji blockquotes (e.g. `> 💡 **Tip:**`).

---

## 🛡️ Agent Execution & Tool Safety Rules

All active AI assistants (including Claude Code, Continue/Codex, OpenCode, and Antigravity) executing commands or writing code in this repository must strictly adhere to these guardrails:

### 1. The Git Sandbox Rule (CRITICAL)
Before allowing any tool or terminal command to modify the filesystem, write new files, or run compiler builds, verify the state of your workspace. If there are uncommitted changes, advise the developer to commit them first. This ensures that any destructive/buggy operation can be immediately reverted using:
```bash
git reset --hard
```

### 2. The Local Verification Rule (Hard Requirement - Cannot Miss)
Never propose a file edit, refactor, or feature addition as completed without verifying the changes locally. You must run the appropriate package test suites natively in the terminal:
*   **Run All Tests:** `npm run test`
*   **Run Core Engine Tests:** `npm test --workspace=packages/engine`
You must execute the command, capture the test results/pass metrics, and output the log details in your conversation response to the developer.

### 3. Tool Calling & Parser Robustness
When writing or editing scripts that parse LLM outputs (e.g. inside `packages/engine/agent-runner/` or CLI parsers), always use regex-based XML tag parsing (`<write_file path="...">...</write_file>`) with non-greedy matches (`[\s\S]*?`). Clean/strip code fences if generated by the model. Avoid standard JSON-only parsers for execution loops as format drift or conversational packaging will crash them.

### 4. Parallel TypeScript & Python Examples
If you write companion scripts, testing examples, or mock adapters inside the `/examples/` folder or codebase docs, provide the snippets in both **TypeScript/JavaScript** and **Python** in parallel to support developers in both language ecosystems.
