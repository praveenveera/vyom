# @garagebuild/plugin-ollama

Connects GarageBuild to a local [Ollama](https://ollama.com) instance. No API key required. All models run locally at zero cost.

## Features

- **No API key** — connects directly to a local Ollama instance
- **Dynamic model discovery** — calls `/api/tags` to list whatever you have pulled
- **Zero cost** — `isLocal: true`, all cost estimates return `$0.00`
- **Newline-delimited JSON streaming** — Ollama streams NDJSON, not SSE

## Install & Build

```bash
npm install --workspace=packages/plugins/plugin-ollama
npm run build --workspace=packages/plugins/plugin-ollama
npm test --workspace=packages/plugins/plugin-ollama    # 26 tests
```

## Configuration

| Field | Default | Description |
|-------|---------|-------------|
| `baseUrl` | `http://localhost:11434` | Ollama server URL |
| `model` | `llama3` | Default model (must be pulled first) |

## Usage

```bash
# First: start Ollama and pull a model
ollama serve
ollama pull llama3
```

```typescript
import { OllamaPlugin } from '@garagebuild/plugin-ollama';

const plugin = new OllamaPlugin();
await plugin.initialize({ baseUrl: 'http://localhost:11434', model: 'llama3' });

// Non-streaming
const response = await plugin.chat({
  messages: [{ role: 'user', content: 'What is 2 + 2?' }],
});
console.log(response.content);  // "4"
console.log(response.inputTokens);   // from Ollama's prompt_eval_count

// Streaming
for await (const chunk of plugin.stream({ messages: [...] })) {
  if (!chunk.isDone) process.stdout.write(chunk.delta);
}

// Discover installed models
const models = await plugin.listAvailableModels();
// [{ modelName: 'llama3:latest', isLocal: true, pricing: { inputCostPer1MTokens: 0 } }, ...]
```

## Context Windows

Known context windows are mapped from Ollama model names:

| Model | Context |
|-------|---------|
| llama3, llama3:8b | 8,192 |
| llama3.1, llama3.2 | 131,072 |
| llama2 | 4,096 |
| mistral, mixtral | 32,768 |
| phi3 | 131,072 |
| qwen2 | 131,072 |
| Unknown models | 8,192 (default) |

## Testing

All 26 tests run without Ollama installed. The plugin accepts an injected `fetcher` in its constructor:

```typescript
const plugin = new OllamaPlugin(mockFetch);
```
