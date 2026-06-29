# @garagebuild/plugin-openai

GarageBuild model plugin for OpenAI. Implements `ModelPlugin` from `@garagebuild/plugin-sdk`. Supports GPT-4o, GPT-4, o1, o1-mini, and GPT-3.5-Turbo with full streaming and cost tracking.

## Supported Models

| Model ID | Input ($/1M tok) | Output ($/1M tok) | Context |
|----------|-----------------|-------------------|---------|
| gpt-4o | $2.50 | $10.00 | 128K |
| gpt-4o-mini | $0.15 | $0.60 | 128K |
| o1 | $15.00 | $60.00 | 200K |
| o1-mini | $3.00 | $12.00 | 128K |
| gpt-4-turbo | $10.00 | $30.00 | 128K |
| gpt-4 | $30.00 | $60.00 | 8K |
| gpt-3.5-turbo | $0.50 | $1.50 | 16K |

Versioned model IDs (e.g. `gpt-4o-2024-11-20`) are matched by prefix — pricing resolves automatically.

## Install & Build

```bash
npm install --workspace=packages/plugins/plugin-openai
npm run build --workspace=packages/plugins/plugin-openai
npm test --workspace=packages/plugins/plugin-openai
```

## Configuration

| Field | Required | Description |
|-------|----------|-------------|
| `apiKey` | Yes | OpenAI API key (`sk-...`) |
| `baseUrl` | No | Override API base URL (default: `https://api.openai.com/v1`) |
| `model` | Yes | Model ID (e.g. `gpt-4o`) |

## Usage

```typescript
import { OpenAIPlugin } from '@garagebuild/plugin-openai';
import type { ChatRequest } from '@garagebuild/plugin-sdk';

const plugin = new OpenAIPlugin();
await plugin.initialize({ apiKey: 'sk-...', model: 'gpt-4o' });

const response = await plugin.chat({
  messages: [{ role: 'user', content: 'Hello!' }],
  model: 'gpt-4o',
});
```

The plugin uses an injected `fetch` function so HTTP calls can be mocked in tests without a real API key.
