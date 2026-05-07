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

const DEFAULT_SEARCH_LIMIT = 20;
const DEFAULT_LIST_LIMIT = 50;
const DEFAULT_LIST_OFFSET = 0;

export {
  MessageRole,
  MemoryType,
  FilterOp,
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_LIST_LIMIT,
  DEFAULT_LIST_OFFSET,
};
export type {
  MessageRole as MessageRoleType,
  MemoryType as MemoryTypeType,
  FilterOp as FilterOpType,
};
