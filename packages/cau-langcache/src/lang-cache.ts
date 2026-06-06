import type {
  LangCacheConfig,
  CacheSetParams,
  CacheSearchParams,
  CacheHit,
} from "./types";

import { LangCache as LangCacheSdk } from "@redis-ai/langcache";

import { loadConfig } from "./config";
import {
  DEFAULT_SIMILARITY_THRESHOLD,
  HEALTH_PROBE_PROMPT,
  HEALTH_PROBE_THRESHOLD,
} from "./constants";

let instance: LangCache | null = null;

class LangCache {
  private client: LangCacheSdk;
  private config: LangCacheConfig;

  private constructor(config: LangCacheConfig) {
    this.config = config;
    this.client = new LangCacheSdk({
      serverURL: config.serverURL,
      cacheId: config.cacheId,
      apiKey: config.apiKey,
    });
  }

  static create = (configOverride?: Partial<LangCacheConfig>): LangCache => {
    const envConfig = loadConfig();
    const mergedConfig: LangCacheConfig = {
      ...envConfig,
      ...configOverride,
    };

    instance = new LangCache(mergedConfig);

    return instance;
  };

  static getInstance = (): LangCache => {
    if (!instance) {
      throw new Error(
        "LangCache not initialized. Call LangCache.create() first.",
      );
    }

    return instance;
  };

  static resetInstance = (): void => {
    instance = null;
  };

  // Returns the best match at or above the threshold, or null on a miss.
  search = async (params: CacheSearchParams): Promise<CacheHit | null> => {
    const threshold = params.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;

    const result = await this.client.search({
      prompt: params.prompt,
      similarityThreshold: threshold,
      attributes: params.attributes,
    });

    const entries = result.data ?? [];
    const best = entries[0];

    // Defensive: the service already filters by threshold, but never trust a
    // match below it.
    const isHit = best !== undefined && best.similarity >= threshold;

    let hit: CacheHit | null = null;
    if (isHit) {
      hit = {
        id: best.id,
        prompt: best.prompt,
        response: best.response,
        attributes: best.attributes,
        similarity: best.similarity,
      };
    }

    return hit;
  };

  // Stores an entry and returns its entryId.
  set = async (params: CacheSetParams): Promise<string> => {
    const result = await this.client.set({
      prompt: params.prompt,
      response: params.response,
      attributes: params.attributes,
      ttlMillis: params.ttlMillis,
    });

    return result.entryId;
  };

  // Deletes entries matching the given attributes; returns deleted count.
  deleteByAttributes = async (
    attributes: Record<string, string>,
  ): Promise<number> => {
    const result = await this.client.deleteQuery({ attributes });

    return result.deletedEntriesCount;
  };

  deleteById = async (entryId: string): Promise<void> => {
    await this.client.deleteById(entryId);
  };

  flush = async (): Promise<void> => {
    await this.client.flush();
  };

  // Probes the service; returns true when reachable, false otherwise.
  health = async (): Promise<boolean> => {
    let isReachable = true;
    try {
      await this.client.search({
        prompt: HEALTH_PROBE_PROMPT,
        similarityThreshold: HEALTH_PROBE_THRESHOLD,
      });
    } catch {
      isReachable = false;
    }

    return isReachable;
  };
}

export { LangCache };
