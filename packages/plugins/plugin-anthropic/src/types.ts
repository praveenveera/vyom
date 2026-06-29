// ─────────────────────────────────────────────────────────────────────────────
// Anthropic Messages API types
// https://docs.anthropic.com/en/api/messages
// ─────────────────────────────────────────────────────────────────────────────

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicCreateRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  system?: string;
  temperature?: number;
  stream?: boolean;
}

export interface AnthropicContentBlock {
  type: 'text';
  text: string;
}

export interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface AnthropicCreateResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | null;
  usage: AnthropicUsage;
}

export interface AnthropicErrorResponse {
  type: 'error';
  error: { type: string; message: string };
}

// ── SSE streaming event shapes ─────────────────────────────────────────────────
//
// Anthropic streams Server-Sent Events. Each `data:` line is one of these.
// We only need a subset: message_start (for id + input tokens),
// content_block_delta (for text), and message_stop (to close the stream).

export interface AnthropicMessageStartEvent {
  type: 'message_start';
  message: { id: string; model: string; usage: { input_tokens: number } };
}

export interface AnthropicContentBlockDeltaEvent {
  type: 'content_block_delta';
  index: number;
  delta: { type: 'text_delta'; text: string };
}

export interface AnthropicMessageDeltaEvent {
  type: 'message_delta';
  delta: { stop_reason: string };
  usage: { output_tokens: number };
}

export interface AnthropicMessageStopEvent {
  type: 'message_stop';
}

export type AnthropicStreamEvent =
  | AnthropicMessageStartEvent
  | AnthropicContentBlockDeltaEvent
  | AnthropicMessageDeltaEvent
  | AnthropicMessageStopEvent
  | { type: string }; // catch-all for events we ignore

// ── Models list ───────────────────────────────────────────────────────────────

export interface AnthropicModelEntry {
  type: 'model';
  id: string;
  display_name: string;
  created_at: string;
}

export interface AnthropicModelsResponse {
  data: AnthropicModelEntry[];
  has_more: boolean;
}
