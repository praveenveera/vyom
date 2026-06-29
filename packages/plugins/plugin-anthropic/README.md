# @garagebuild/plugin-anthropic

Connects GarageBuild to Anthropic's Claude models via the Messages API. Supports streaming, system-message extraction, and accurate per-model cost tracking.

## Models

| Model | Input / 1M | Output / 1M | Context |
|-------|-----------|------------|---------|
| Claude Opus 4.8 (`claude-opus-4-8`) | $15.00 | $75.00 | 200K |
| Claude Sonnet 4.6 (`claude-sonnet-4-6`) | $3.00 | $15.00 | 200K |
| Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | $0.25 | $1.25 | 200K |
| Claude 3.5 Sonnet | $3.00 | $15.00 | 200K |
| Claude 3.5 Haiku | $0.80 | $4.00 | 200K |
| Claude 3 Opus | $15.00 | $75.00 | 200K |

Default model: `claude-haiku-4-5-20251001`

## Install & Build

```bash
npm install --workspace=packages/plugins/plugin-anthropic
npm run build --workspace=packages/plugins/plugin-anthropic
npm test --workspace=packages/plugins/plugin-anthropic    # 39 tests
```

## Configuration

| Field | Required | Description |
|-------|----------|-------------|
| `apiKey` | Yes | Anthropic API key from [console.anthropic.com](https://console.anthropic.com) |
| `model` | No | Default model ID (e.g. `claude-sonnet-4-6-20250219`) |

## Key Differences from OpenAI

- **Auth header**: `x-api-key: <key>` (not `Authorization: Bearer`)
- **API version header**: `anthropic-version: 2023-06-01` (required on every request)
- **`max_tokens`**: Required on every request (defaults to 4096)
- **System messages**: Extracted from the messages array into a top-level `system` field — Anthropic does not accept `role: "system"` in messages
- **SSE events**: `content_block_delta` with `delta.text`, terminated by `message_stop` (not `[DONE]`)

## Usage

```typescript
import { AnthropicPlugin } from '@garagebuild/plugin-anthropic';

const plugin = new AnthropicPlugin();
await plugin.initialize({ apiKey: 'sk-ant-...', model: 'claude-sonnet-4-6-20250219' });

// Non-streaming
const response = await plugin.chat({
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Write a haiku about TypeScript.' },
  ],
});
console.log(response.content);

// Streaming
for await (const chunk of plugin.stream({ messages: [...] })) {
  if (!chunk.isDone) process.stdout.write(chunk.delta);
}
```

## Testing

All 39 tests run without a real API key. The plugin accepts an injected `fetcher` in its constructor for test isolation:

```typescript
const plugin = new AnthropicPlugin(mockFetch);
```
