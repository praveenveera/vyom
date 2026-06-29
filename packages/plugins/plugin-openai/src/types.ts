// ─────────────────────────────────────────────────────────────────────────────
// OpenAI Chat Completions API types
// https://platform.openai.com/docs/api-reference/chat
// ─────────────────────────────────────────────────────────────────────────────

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIChatRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface OpenAIChoice {
  index: number;
  message: { role: 'assistant'; content: string };
  finish_reason: 'stop' | 'length' | 'content_filter' | null;
}

export interface OpenAIChatResponse {
  id: string;
  object: 'chat.completion';
  model: string;
  choices: OpenAIChoice[];
  usage: OpenAIUsage;
}

export interface OpenAIErrorResponse {
  error: { message: string; type: string; code: string | null };
}

// ── SSE streaming ─────────────────────────────────────────────────────────────
//
// OpenAI streaming chunks carry a choices array where each choice has a `delta`
// with an optional `content` field, and a `finish_reason` when the stream ends.

export interface OpenAIStreamDelta {
  content?: string;
  role?: string;
}

export interface OpenAIStreamChoice {
  index: number;
  delta: OpenAIStreamDelta;
  finish_reason: 'stop' | 'length' | 'content_filter' | null;
}

export interface OpenAIStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  model: string;
  choices: OpenAIStreamChoice[];
}

// ── Models list ───────────────────────────────────────────────────────────────

export interface OpenAIModelEntry {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
}

export interface OpenAIModelsResponse {
  object: 'list';
  data: OpenAIModelEntry[];
}
