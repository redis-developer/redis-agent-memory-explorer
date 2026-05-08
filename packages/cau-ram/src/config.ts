import type { RamConfig, LlmConfig, RedisAgentMemoryConfig } from "./types";

import dotenv from "dotenv";

dotenv.config();

const loadRamConfig = (): RamConfig => {
  const endpoint = process.env.RAM_ENDPOINT;
  const apiKey = process.env.RAM_API_KEY;
  const storeId = process.env.RAM_STORE_ID;

  if (!endpoint) {
    throw new Error("RAM_ENDPOINT environment variable is required");
  }
  if (!apiKey) {
    throw new Error("RAM_API_KEY environment variable is required");
  }
  if (!storeId) {
    throw new Error("RAM_STORE_ID environment variable is required");
  }

  return { endpoint, apiKey, storeId };
};

const loadLlmConfig = (): LlmConfig | undefined => {
  const model = process.env.SUMMARY_MODEL;
  const apiKey = process.env.OPENAI_API_KEY;

  const hasAll = model && apiKey;
  if (!hasAll) {
    return undefined;
  }

  return { model, apiKey };
};

const loadConfig = (): RedisAgentMemoryConfig => {
  const ram = loadRamConfig();
  const llm = loadLlmConfig();

  return { ram, llm };
};

export { loadRamConfig, loadLlmConfig, loadConfig };
