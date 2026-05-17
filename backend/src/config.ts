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
} from "./constants";

const parseAllowedOrigins = (raw: string | undefined): string[] => {
  let result = DEFAULT_ALLOWED_ORIGINS;
  if (raw) {
    result = raw.split(",").map((o) => o.trim());
  }

  return result;
};

const ENV = {
  PORT: Number(process.env.MEETING_MEMORY_PORT) || DEFAULT_PORT,
  RAM_ENDPOINT: process.env.RAM_ENDPOINT ?? "",
  RAM_API_KEY: process.env.RAM_API_KEY ?? "",
  RAM_STORE_ID: process.env.RAM_STORE_ID ?? "",
  LLM_MODEL: process.env.LLM_MODEL ?? DEFAULT_LLM_MODEL,
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
} as const;

export { ENV };
