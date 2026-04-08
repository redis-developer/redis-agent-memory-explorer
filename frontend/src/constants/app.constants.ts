const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const COPILOTKIT_RUNTIME_URL =
  process.env.NEXT_PUBLIC_COPILOTKIT_RUNTIME_URL ??
  "http://localhost:3001/copilotkit";

const WORKING_MEMORY_POLL_INTERVAL_MS = 3000;
const WM_POST_COMPLETION_GRACE_MS = 15000;
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
  AI_COPILOT: "ai-copilot",
  WORKING_MEMORY: "working-memory",
  LONG_TERM_MEMORY: "long-term-memory",
  SUMMARY_VIEWS: "summary-views",
  REDIS_METRICS: "redis-metrics",
} as const;

const PLAYBACK_STATUS = {
  IDLE: "idle",
  LOADING: "loading",
  PLAYING: "playing",
  PAUSED: "paused",
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
  SESSION_ID: "session_id",
  NAMESPACE: "namespace",
} as const;

const CONTEXT_THRESHOLD = {
  HIGH: 80,
  MEDIUM: 50,
  FULL: 100,
} as const;

const LT_SCOPE = {
  SESSION: "session",
  ALL: "all",
} as const;
type LtScope = (typeof LT_SCOPE)[keyof typeof LT_SCOPE];

const DETECTED_TOPIC_STATUS = {
  PENDING: "pending",
  DISCUSSED: "discussed",
  NEW: "new",
  QUESTION: "question",
} as const;
type DetectedTopicStatus = (typeof DETECTED_TOPIC_STATUS)[keyof typeof DETECTED_TOPIC_STATUS];

const DETECTED_TOPIC_SOURCE = {
  PRE_SEEDED: "pre-seeded",
  AI_DETECTED: "ai-detected",
} as const;
type DetectedTopicSource = (typeof DETECTED_TOPIC_SOURCE)[keyof typeof DETECTED_TOPIC_SOURCE];

const STABILIZATION_POLL_COUNT = 3;
const DEFAULT_TRIGGER_EVERY_N_CHUNKS = 5;
const SEARCH_ALL_LIMIT = 100;
const LAST_MESSAGES_COUNT = 5;
const AUTO_SCROLL_THRESHOLD_PX = 80;
const SPEED_SELECT_MIN_WIDTH = 80;
const SESSION_SELECT_MIN_WIDTH = 200;
const MAX_MEMORY_TEXT_LENGTH = 200;

const SESSION_ID_PREFIX = "playback";
const SESSION_ID_PATTERN = /^playback-(.+)-(\d{13,})$/;

const DEFAULT_CHATBOT_TITLE = "Memory Assistant";
const DEFAULT_CHATBOT_INITIAL =
  "Ask me anything about the stored memories for this client. I can search across all meetings or focus on a specific session.";
const DEFAULT_CHATBOT_PLACEHOLDER = "Ask about memories...";
const DEFAULT_CHATBOT_INSTRUCTIONS = "";

export {
  DETECTED_TOPIC_STATUS,
  DETECTED_TOPIC_SOURCE,
  API_BASE_URL,
  COPILOTKIT_RUNTIME_URL,
  WORKING_MEMORY_POLL_INTERVAL_MS,
  WM_POST_COMPLETION_GRACE_MS,
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
  LT_SCOPE,
  SEARCH_ALL_LIMIT,
  CONTEXT_THRESHOLD,
  LAST_MESSAGES_COUNT,
  AUTO_SCROLL_THRESHOLD_PX,
  SPEED_SELECT_MIN_WIDTH,
  SESSION_SELECT_MIN_WIDTH,
  MAX_MEMORY_TEXT_LENGTH,
  SESSION_ID_PREFIX,
  SESSION_ID_PATTERN,
  MEMORY_TYPE_LABEL,
  DEFAULT_CHATBOT_TITLE,
  DEFAULT_CHATBOT_INITIAL,
  DEFAULT_CHATBOT_PLACEHOLDER,
  DEFAULT_CHATBOT_INSTRUCTIONS,
  STABILIZATION_POLL_COUNT,
  DEFAULT_TRIGGER_EVERY_N_CHUNKS,
};

export type { MemoryType, HealthStatus, LtScope, DetectedTopicStatus, DetectedTopicSource };
