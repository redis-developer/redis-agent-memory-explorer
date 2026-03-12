const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const WORKING_MEMORY_POLL_INTERVAL_MS = 3000;
const LT_MEMORY_POLL_AFTER_EXTRACTION_MS = 5000;
const EXTRACTION_POLL_INTERVAL_MS = 5000;
const EXTRACTION_MAX_WAIT_MS = 60000;

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

export {
  API_BASE_URL,
  WORKING_MEMORY_POLL_INTERVAL_MS,
  LT_MEMORY_POLL_AFTER_EXTRACTION_MS,
  EXTRACTION_POLL_INTERVAL_MS,
  EXTRACTION_MAX_WAIT_MS,
  DEMO_TAB,
  PLAYBACK_STATUS,
  EXPLORER_STATUS,
};
