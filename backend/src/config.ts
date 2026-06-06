import { resolve } from "node:path";

import {
  DEFAULT_PORT,
  DEFAULT_LLM_MODEL,
  DEFAULT_DATA_DIR,
  DEFAULT_ACTIVE_DATASET,
  DEFAULT_CONTEXT_WINDOW_MAX,
  DEFAULT_ALLOWED_ORIGINS,
  DEFAULT_LANGGRAPH_DEPLOYMENT_URL,
  DEFAULT_REDIS_URL,
  DEFAULT_LOG_DIR,
  DEFAULT_LANGCACHE_SIMILARITY_THRESHOLD,
  DEFAULT_LANGCACHE_TTL_MILLIS,
  DEFAULT_LANGCACHE_NORMALIZE_MAX_TOKENS,
} from "./constants";

const parseAllowedOrigins = (raw: string | undefined): string[] => {
  let result = DEFAULT_ALLOWED_ORIGINS;
  if (raw) {
    result = raw.split(",").map((o) => o.trim());
  }

  return result;
};

// Interactive, user-facing path: chatbot ReAct agent + LangCache query normalizer.
const CHATBOT_MODEL =
  process.env.MEETING_MEMORY_CHATBOT_MODEL ?? DEFAULT_LLM_MODEL;
// Background path: suggestions, query extraction, and memory summarization.
const BACKGROUND_MODEL =
  process.env.MEETING_MEMORY_BACKGROUND_MODEL ?? DEFAULT_LLM_MODEL;

const ENV = {
  PORT: Number(process.env.MEETING_MEMORY_PORT) || DEFAULT_PORT,
  RAM_ENDPOINT: process.env.RAM_ENDPOINT ?? "",
  RAM_API_KEY: process.env.RAM_API_KEY ?? "",
  RAM_STORE_ID: process.env.RAM_STORE_ID ?? "",
  CHATBOT_MODEL,
  BACKGROUND_MODEL,
  DATA_DIR: resolve(
    __dirname,
    process.env.MEETING_MEMORY_DATA_DIR ?? DEFAULT_DATA_DIR,
  ),
  ACTIVE_DATASET:
    process.env.MEETING_MEMORY_ACTIVE_DATASET ?? DEFAULT_ACTIVE_DATASET,
  CONTEXT_WINDOW_MAX:
    Number(process.env.MEETING_MEMORY_CONTEXT_WINDOW_MAX) ||
    DEFAULT_CONTEXT_WINDOW_MAX,
  ALLOWED_ORIGINS: parseAllowedOrigins(
    process.env.MEETING_MEMORY_ALLOWED_ORIGINS,
  ),
  LANGGRAPH_DEPLOYMENT_URL:
    process.env.LANGGRAPH_DEPLOYMENT_URL ?? DEFAULT_LANGGRAPH_DEPLOYMENT_URL,
  LANGSMITH_API_KEY: process.env.LANGSMITH_API_KEY ?? "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
  REDIS_URL: process.env.REDIS_URL ?? DEFAULT_REDIS_URL,
  CTX_ADMIN_KEY: process.env.CTX_ADMIN_KEY ?? "",
  CTX_ADMIN_API_URL: process.env.CTX_ADMIN_API_URL ?? "",
  CTX_MCP_URL: process.env.CTX_MCP_URL ?? "",
  CTX_SURFACE_ID: process.env.CTX_SURFACE_ID ?? "",
  MCP_AGENT_KEY: process.env.MCP_AGENT_KEY ?? "",
  LOG_DIR: resolve(
    __dirname,
    process.env.MEETING_MEMORY_LOG_DIR ?? DEFAULT_LOG_DIR,
  ),
  LANGCACHE_ENABLED: (process.env.LANGCACHE_ENABLED ?? "false") === "true",
  LANGCACHE_SERVER_URL: process.env.LANGCACHE_SERVER_URL ?? "",
  LANGCACHE_CACHE_ID: process.env.LANGCACHE_CACHE_ID ?? "",
  LANGCACHE_API_KEY: process.env.LANGCACHE_API_KEY ?? "",
  LANGCACHE_SIMILARITY_THRESHOLD:
    Number(process.env.LANGCACHE_SIMILARITY_THRESHOLD) ||
    DEFAULT_LANGCACHE_SIMILARITY_THRESHOLD,
  LANGCACHE_TTL_MILLIS:
    Number(process.env.LANGCACHE_TTL_MILLIS) || DEFAULT_LANGCACHE_TTL_MILLIS,
  LANGCACHE_NORMALIZE_MAX_TOKENS:
    Number(process.env.LANGCACHE_NORMALIZE_MAX_TOKENS) ||
    DEFAULT_LANGCACHE_NORMALIZE_MAX_TOKENS,
} as const;

export { ENV };
