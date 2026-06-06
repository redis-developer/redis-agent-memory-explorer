// ── Config ──

type LangCacheConfig = {
  serverURL: string;
  cacheId?: string;
  apiKey?: string;
};

// ── Operations ──

type CacheSetParams = {
  prompt: string;
  response: string;
  attributes?: Record<string, string>;
  ttlMillis?: number;
};

type CacheSearchParams = {
  prompt: string;
  similarityThreshold?: number;
  attributes?: Record<string, string>;
};

type CacheHit = {
  id: string;
  prompt: string;
  response: string;
  attributes: Record<string, string>;
  similarity: number;
};

export type { LangCacheConfig, CacheSetParams, CacheSearchParams, CacheHit };
