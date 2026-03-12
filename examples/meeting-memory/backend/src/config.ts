import { resolve } from "node:path";

import {
  DEFAULT_PORT,
  DEFAULT_AGENT_MEMORY_BASE_URL,
  DEFAULT_DATA_DIR,
  DEFAULT_ACTIVE_DATASET,
  DEFAULT_MODEL_NAME,
  DEFAULT_ALLOWED_ORIGINS,
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
  AGENT_MEMORY_BASE_URL:
    process.env.AGENT_MEMORY_BASE_URL ?? DEFAULT_AGENT_MEMORY_BASE_URL,
  DATA_DIR: resolve(
    __dirname,
    process.env.MEETING_MEMORY_DATA_DIR ?? DEFAULT_DATA_DIR,
  ),
  ACTIVE_DATASET:
    process.env.MEETING_MEMORY_ACTIVE_DATASET ?? DEFAULT_ACTIVE_DATASET,
  MODEL_NAME: process.env.MEETING_MEMORY_MODEL_NAME ?? DEFAULT_MODEL_NAME,
  ALLOWED_ORIGINS: parseAllowedOrigins(
    process.env.MEETING_MEMORY_ALLOWED_ORIGINS,
  ),
} as const;

export { ENV };
