const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_SEARCH_LIMIT = 10;
const DEFAULT_SESSION_LIST_LIMIT = 100;

const MemoryType = {
  SEMANTIC: "semantic",
  EPISODIC: "episodic",
  MESSAGE: "message",
} as const;
type MemoryType = (typeof MemoryType)[keyof typeof MemoryType];

const ExtractionStrategy = {
  DISCRETE: "discrete",
  SUMMARY: "summary",
  PREFERENCES: "preferences",
  CUSTOM: "custom",
} as const;
type ExtractionStrategy =
  (typeof ExtractionStrategy)[keyof typeof ExtractionStrategy];

const SummaryViewSource = {
  LONG_TERM: "long_term",
  WORKING_MEMORY: "working_memory",
} as const;
type SummaryViewSource =
  (typeof SummaryViewSource)[keyof typeof SummaryViewSource];

const TaskStatus = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;
type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export {
  DEFAULT_TIMEOUT_MS,
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SESSION_LIST_LIMIT,
  MemoryType,
  ExtractionStrategy,
  SummaryViewSource,
  TaskStatus,
};
