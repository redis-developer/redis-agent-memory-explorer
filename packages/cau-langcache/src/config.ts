import type { LangCacheConfig } from "./types";

import { config as loadEnv } from "dotenv";

loadEnv();

const loadConfig = (): LangCacheConfig => {
  const serverURL = process.env.LANGCACHE_SERVER_URL;
  const cacheId = process.env.LANGCACHE_CACHE_ID;
  const apiKey = process.env.LANGCACHE_API_KEY;

  if (!serverURL) {
    throw new Error("LANGCACHE_SERVER_URL environment variable is required");
  }

  return {
    serverURL,
    cacheId: cacheId || undefined,
    apiKey: apiKey || undefined,
  };
};

export { loadConfig };
