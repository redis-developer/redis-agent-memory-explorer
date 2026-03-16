const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const WORKING_MEMORY_POLL_INTERVAL_MS = 3000;
const LT_MEMORY_POLL_AFTER_EXTRACTION_MS = 5000;
const EXTRACTION_POLL_INTERVAL_MS = 5000;
const EXTRACTION_MAX_WAIT_MS = 60000;
const HEALTH_CHECK_INTERVAL_MS = 30000;

const MEMORY_TYPE = {
  SEMANTIC: "semantic",
  EPISODIC: "episodic",
  MESSAGE: "message",
} as const;
type MemoryType = (typeof MEMORY_TYPE)[keyof typeof MEMORY_TYPE];

const MEMORY_TYPE_LABEL: Record<MemoryType, string> = {
  [MEMORY_TYPE.SEMANTIC]: "Semantic",
  [MEMORY_TYPE.EPISODIC]: "Episodic",
  [MEMORY_TYPE.MESSAGE]: "Message",
};

const HEALTH_STATUS = {
  OK: "ok",
  ERROR: "error",
  CHECKING: "checking",
} as const;
type HealthStatus = (typeof HEALTH_STATUS)[keyof typeof HEALTH_STATUS];

const DEMO_TAB = {
  WORKING_MEMORY: "working-memory",
  LONG_TERM_MEMORY: "long-term-memory",
  SUMMARY_VIEWS: "summary-views",
  REDIS_METRICS: "redis-metrics",
} as const;

const PLAYBACK_STATUS = {
  IDLE: "idle",
  LOADING: "loading",
  PLAYING: "playing",
  COMPLETED: "completed",
  ERROR: "error",
} as const;

const EXPLORER_STATUS = {
  IDLE: "idle",
  OBSERVING: "observing",
  EXTRACTING: "extracting",
  EXPLORING: "exploring",
  ERROR: "error",
} as const;

const TRANSCRIPT_ROLE = {
  RM: "rm",
} as const;

const SUMMARY_GROUP_BY_KEY = {
  USER_ID: "user_id",
} as const;

const CONTEXT_THRESHOLD = {
  HIGH: 80,
  MEDIUM: 50,
  FULL: 100,
} as const;

const LAST_MESSAGES_COUNT = 5;
const AUTO_SCROLL_THRESHOLD_PX = 80;
const SPEED_SELECT_MIN_WIDTH = 80;
const MAX_MEMORY_TEXT_LENGTH = 200;

export {
  API_BASE_URL,
  WORKING_MEMORY_POLL_INTERVAL_MS,
  LT_MEMORY_POLL_AFTER_EXTRACTION_MS,
  EXTRACTION_POLL_INTERVAL_MS,
  EXTRACTION_MAX_WAIT_MS,
  HEALTH_CHECK_INTERVAL_MS,
  MEMORY_TYPE,
  HEALTH_STATUS,
  DEMO_TAB,
  PLAYBACK_STATUS,
  EXPLORER_STATUS,
  TRANSCRIPT_ROLE,
  SUMMARY_GROUP_BY_KEY,
  CONTEXT_THRESHOLD,
  LAST_MESSAGES_COUNT,
  AUTO_SCROLL_THRESHOLD_PX,
  SPEED_SELECT_MIN_WIDTH,
  MAX_MEMORY_TEXT_LENGTH,
  MEMORY_TYPE_LABEL,
};

export type { MemoryType, HealthStatus };
