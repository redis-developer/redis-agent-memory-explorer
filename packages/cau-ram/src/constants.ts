const MessageRole = {
  USER: "USER",
  ASSISTANT: "ASSISTANT",
  SYSTEM: "SYSTEM",
} as const;
type MessageRole = (typeof MessageRole)[keyof typeof MessageRole];

const MemoryType = {
  SEMANTIC: "semantic",
  EPISODIC: "episodic",
  MESSAGE: "message",
} as const;
type MemoryType = (typeof MemoryType)[keyof typeof MemoryType];

const FilterOp = {
  ALL: "all",
  ANY: "any",
} as const;
type FilterOp = (typeof FilterOp)[keyof typeof FilterOp];

const DEFAULT_LTM_SEARCH_LIMIT = 20;
const DEFAULT_LTM_PROMPT_LIMIT = 10;
const DEFAULT_LIST_LIMIT = 50;
const DEFAULT_LIST_OFFSET = 0;
const FORMATTING_OVERHEAD_TOKENS = 200;
const PER_MESSAGE_TOKEN_OVERHEAD = 4;
const DEFAULT_CONTEXT_WINDOW = 128_000;

// Retry/backoff for transient cloud errors (429 rate limits, 5xx, timeouts).
const RAM_RETRY_INITIAL_INTERVAL_MS = 500;
const RAM_RETRY_MAX_INTERVAL_MS = 30_000;
const RAM_RETRY_BACKOFF_EXPONENT = 1.5;
const RAM_RETRY_MAX_ELAPSED_MS = 30_000;

const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  "gpt-4o": 128_000,
  "gpt-4o-mini": 128_000,
  "gpt-4-turbo": 128_000,
  "gpt-4": 8_192,
  "gpt-3.5-turbo": 16_385,
  "claude-3-opus": 200_000,
  "claude-3-sonnet": 200_000,
  "claude-3-haiku": 200_000,
  "claude-3.5-sonnet": 200_000,
  "claude-4-opus": 200_000,
  "claude-4-sonnet": 200_000,
  "gemini-1.5-pro": 1_000_000,
  "gemini-1.5-flash": 1_000_000,
  "gemini-2.0-flash": 1_000_000,
};

export {
  MessageRole,
  MemoryType,
  FilterOp,
  DEFAULT_LTM_SEARCH_LIMIT,
  DEFAULT_LTM_PROMPT_LIMIT,
  DEFAULT_LIST_LIMIT,
  DEFAULT_LIST_OFFSET,
  FORMATTING_OVERHEAD_TOKENS,
  PER_MESSAGE_TOKEN_OVERHEAD,
  DEFAULT_CONTEXT_WINDOW,
  MODEL_CONTEXT_WINDOWS,
  RAM_RETRY_INITIAL_INTERVAL_MS,
  RAM_RETRY_MAX_INTERVAL_MS,
  RAM_RETRY_BACKOFF_EXPONENT,
  RAM_RETRY_MAX_ELAPSED_MS,
};
export type {
  MessageRole as MessageRoleType,
  MemoryType as MemoryTypeType,
  FilterOp as FilterOpType,
};
