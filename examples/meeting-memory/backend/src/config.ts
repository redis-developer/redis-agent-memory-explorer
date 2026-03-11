import { resolve } from "node:path";

const DEFAULT_PORT = 3001;
const DEFAULT_AGENT_MEMORY_BASE_URL = "http://localhost:8000";
const DEFAULT_DATA_DIR = "../../data";
const DEFAULT_ACTIVE_DATASET = "wealth-advisor";
const DEFAULT_MODEL_NAME = "gpt-4o-mini";
const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:3000"];

const PORT = Number(process.env.MEETING_MEMORY_PORT) || DEFAULT_PORT;

const AGENT_MEMORY_BASE_URL =
  process.env.AGENT_MEMORY_BASE_URL ?? DEFAULT_AGENT_MEMORY_BASE_URL;

const DATA_DIR = resolve(
  __dirname,
  process.env.MEETING_MEMORY_DATA_DIR ?? DEFAULT_DATA_DIR,
);

const ACTIVE_DATASET =
  process.env.MEETING_MEMORY_ACTIVE_DATASET ?? DEFAULT_ACTIVE_DATASET;

const MODEL_NAME =
  process.env.MEETING_MEMORY_MODEL_NAME ?? DEFAULT_MODEL_NAME;

const ALLOWED_ORIGINS = process.env.MEETING_MEMORY_ALLOWED_ORIGINS
  ? process.env.MEETING_MEMORY_ALLOWED_ORIGINS.split(",").map((o) =>
      o.trim(),
    )
  : DEFAULT_ALLOWED_ORIGINS;

export {
  PORT,
  AGENT_MEMORY_BASE_URL,
  DATA_DIR,
  ACTIVE_DATASET,
  MODEL_NAME,
  ALLOWED_ORIGINS,
};
