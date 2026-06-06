import { LangCache } from "./lang-cache";
import { loadConfig } from "./config";
import {
  DEFAULT_SIMILARITY_THRESHOLD,
  DEFAULT_TTL_MILLIS,
} from "./constants";

export { LangCache, loadConfig, DEFAULT_SIMILARITY_THRESHOLD, DEFAULT_TTL_MILLIS };

export type {
  LangCacheConfig,
  CacheSetParams,
  CacheSearchParams,
  CacheHit,
} from "./types";
