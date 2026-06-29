// ─────────────────────────────────────────────────────────────────────────────
// Ollama REST API types
// https://github.com/ollama/ollama/blob/main/docs/api.md
// ─────────────────────────────────────────────────────────────────────────────

export interface OllamaMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// POST /api/chat
export interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  stream: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
  };
}

// Non-streaming response (stream: false)
export interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: OllamaMessage;
  done: true;
  done_reason: string;
  total_duration: number;
  load_duration: number;
  prompt_eval_count: number;
  eval_count: number;
  eval_duration: number;
}

// Each line of a streaming response (stream: true), NDJSON
export interface OllamaStreamChunk {
  model: string;
  created_at: string;
  message: OllamaMessage;
  done: boolean;
  // Only present on the final chunk (done: true)
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

// GET /api/tags
export interface OllamaModelDetails {
  parent_model: string;
  format: string;
  family: string;
  families: string[];
  parameter_size: string;
  quantization_level: string;
}

export interface OllamaModelEntry {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: OllamaModelDetails;
}

export interface OllamaTagsResponse {
  models: OllamaModelEntry[];
}
