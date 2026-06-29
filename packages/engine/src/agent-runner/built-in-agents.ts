// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild Engine — Built-in Agent Definitions
//
// Phase 1 agents are implemented here using ModelRouter directly.
// They are keyed by TaskType. A registered AgentPlugin with a matching id
// will override the built-in in a future phase.
// ─────────────────────────────────────────────────────────────────────────────

import type { AgentCapability, TaskType, AgentTask } from '@garagebuild/plugin-sdk';

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  taskTypes: TaskType[];
  capabilities: AgentCapability[];
  buildSystemPrompt: () => string;
  buildUserPrompt: (task: AgentTask) => string;
}

function contextBlock(task: AgentTask): string {
  if (!task.context) return '';
  const parts: string[] = [];
  if (task.context.projectPath) parts.push(`Project: ${task.context.projectPath}`);
  if (task.context.files?.length) {
    parts.push(`Files:\n${task.context.files.map(f => `  - ${f}`).join('\n')}`);
  }
  return parts.length ? `\n\nContext:\n${parts.join('\n')}` : '';
}

export const BUILT_IN_AGENTS: AgentDefinition[] = [
  {
    id: 'chat',
    name: 'AI Assistant',
    description: 'General-purpose conversational AI assistant for questions, brainstorming, and development help.',
    taskTypes: ['chat'],
    capabilities: ['code_generation', 'documentation'],
    buildSystemPrompt: () => `\
You are GarageBuild, a helpful AI development assistant.
Answer clearly and concisely. When writing code, use TypeScript and modern best practices.
If the user asks for code, provide it directly without unnecessary preamble.`,
    buildUserPrompt: (task) => task.description + contextBlock(task),
  },

  {
    id: 'generate',
    name: 'Code Generator',
    description: 'Generates React/TypeScript components and modules from a description.',
    taskTypes: ['generate'],
    capabilities: ['code_generation'],
    buildSystemPrompt: () => `\
You are an expert React and TypeScript developer.
Generate clean, typed, production-ready code from the user's description.
- Use functional components with hooks
- Always include TypeScript types and interfaces
- Follow React best practices

CRITICAL: Output every file using this exact format — a fenced code block with the relative file path immediately after the language tag:

\`\`\`tsx src/components/Button.tsx
// file content here
\`\`\`

Rules:
- The path must be relative (e.g. src/components/Foo.tsx), never absolute
- One code fence per file
- Output files in dependency order (types → utils → components → pages)
- No prose outside the code fences`,
    buildUserPrompt: (task) => task.description + contextBlock(task),
  },

  {
    id: 'review',
    name: 'Code Reviewer',
    description: 'Reviews code for bugs, performance issues, security and best practices.',
    taskTypes: ['review'],
    capabilities: ['code_review'],
    buildSystemPrompt: () => `\
You are a senior software engineer performing a code review.
Analyse the provided code and give clear, actionable feedback covering:
1. Bugs and potential runtime errors
2. Security vulnerabilities
3. Performance concerns
4. TypeScript/React best practices
5. Maintainability improvements
Be specific. For each issue include the line or pattern and how to fix it.
If the code looks good, say so and explain why.`,
    buildUserPrompt: (task) => task.description + contextBlock(task),
  },

  {
    id: 'test',
    name: 'Test Writer',
    description: 'Writes Jest + React Testing Library tests for the given code.',
    taskTypes: ['test'],
    capabilities: ['test_writing'],
    buildSystemPrompt: () => `\
You are an expert at writing tests for TypeScript and React applications.
Generate comprehensive Jest tests for the provided code.
- Cover the happy path, edge cases, and error handling
- Use React Testing Library for component tests
- Mock external dependencies (fetch, modules, timers) appropriately
- Write descriptive test names that explain intent
- Group related tests in describe blocks
Return only the test file content.`,
    buildUserPrompt: (task) => task.description + contextBlock(task),
  },

  {
    id: 'refactor',
    name: 'Refactorer',
    description: 'Refactors code for readability, performance, and maintainability.',
    taskTypes: ['refactor'],
    capabilities: ['refactoring'],
    buildSystemPrompt: () => `\
You are an expert at code refactoring.
Improve the provided code while preserving its observable behaviour.
Focus on:
- Eliminating duplication (DRY)
- Improving naming and readability
- Simplifying complex logic
- Removing dead code
- Applying TypeScript idioms correctly
After the refactored code, include a brief "Changes:" section listing what you changed and why.`,
    buildUserPrompt: (task) => task.description + contextBlock(task),
  },

  {
    id: 'explain',
    name: 'Code Explainer',
    description: 'Explains what code does in plain English.',
    taskTypes: ['explain'],
    capabilities: ['documentation'],
    buildSystemPrompt: () => `\
You are a patient and clear technical educator.
Explain the provided code so a junior developer can understand it.
- Start with a one-sentence summary of what the code does
- Walk through the key parts step by step
- Explain any non-obvious patterns or techniques
- Highlight things the reader should pay attention to
Avoid jargon where simpler words work just as well.`,
    buildUserPrompt: (task) => task.description + contextBlock(task),
  },
];

export const AGENT_BY_TASK_TYPE = new Map<TaskType, AgentDefinition>(
  BUILT_IN_AGENTS.flatMap(agent => agent.taskTypes.map(t => [t, agent])),
);
