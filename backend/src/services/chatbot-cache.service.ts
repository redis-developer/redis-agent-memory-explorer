import { LangCache } from "cau-langcache";
import { Logger } from "cau-logger";

import { ENV } from "../config";
import { LANGCACHE_FEATURE } from "../constants";

type CacheScope = { userId: string; namespace: string };
type CachedAnswer = { text: string; similarity: number; matchedPrompt: string };

let _logger: ReturnType<typeof Logger.getInstance> | null = null;
const getLogger = () => {
  if (!_logger) {
    _logger = Logger.getInstance().child({ component: "ChatbotCache" });
  }
  return _logger;
};

const filterAttributes = (scope: CacheScope): Record<string, string> => ({
  feature: LANGCACHE_FEATURE,
  userId: scope.userId,
  namespace: scope.namespace,
});

/*
 * Reads the cache for a previously stored answer to an (already-normalized)
 * standalone question. Filters by partition attributes only -- never by the raw
 * question text. Returns null on miss, when disabled, or on any error (the cache
 * must never break the chatbot).
 */
const getCachedAnswer = async (
  standalone: string,
  scope: CacheScope,
): Promise<CachedAnswer | null> => {
  let result: CachedAnswer | null = null;

  if (ENV.LANGCACHE_ENABLED) {
    const logger = getLogger();
    const startMs = Date.now();

    try {
      const hit = await LangCache.getInstance().search({
        prompt: standalone,
        similarityThreshold: ENV.LANGCACHE_SIMILARITY_THRESHOLD,
        attributes: filterAttributes(scope),
      });

      logger.info("Cache lookup", {
        cacheHit: hit !== null,
        similarity: hit?.similarity,
        standalone,
        latencyMs: Date.now() - startMs,
      });

      if (hit !== null) {
        result = {
          text: hit.response,
          similarity: hit.similarity,
          matchedPrompt: hit.prompt,
        };
      }
    } catch (error) {
      logger.warn("Cache lookup failed -- falling through to agent", {
        error: error instanceof Error ? error.message : String(error),
        standalone,
      });
    }
  }

  return result;
};

/*
 * Stores a fresh answer keyed by the normalized standalone question. Append-only
 * (a new entry coexists with any older one; both expire via TTL). No-op when
 * disabled, when the answer is empty, or on any error.
 *
 * NOTE: `rawQuestion` is logged for raw->normalized observability but is NOT
 * stored as an attribute -- the provisioned cache enforces an attribute schema
 * (feature, userId, namespace) and rejects any other key with a 400.
 */
const cacheAnswer = async (
  standalone: string,
  answer: string,
  scope: CacheScope,
  rawQuestion: string,
): Promise<void> => {
  const hasAnswer = answer.trim().length > 0;
  const shouldCache = ENV.LANGCACHE_ENABLED && hasAnswer;

  if (shouldCache) {
    const logger = getLogger();
    const startMs = Date.now();

    try {
      const entryId = await LangCache.getInstance().set({
        prompt: standalone,
        response: answer,
        attributes: filterAttributes(scope),
        ttlMillis: ENV.LANGCACHE_TTL_MILLIS,
      });

      logger.info("Cached answer", {
        entryId,
        standalone,
        rawQuestion,
        latencyMs: Date.now() - startMs,
      });
    } catch (error) {
      logger.warn("Cache write failed", {
        error: error instanceof Error ? error.message : String(error),
        standalone,
      });
    }
  }
};

/*
 * Drops all chatbot cache entries for a user (called on lifecycle reset, when
 * memories are wiped). No-op when disabled or on error.
 */
const clearForUser = async (userId: string): Promise<void> => {
  if (ENV.LANGCACHE_ENABLED) {
    const logger = getLogger();

    try {
      const deletedCount = await LangCache.getInstance().deleteByAttributes({
        feature: LANGCACHE_FEATURE,
        userId,
      });

      logger.info("Cleared chatbot cache for user", { userId, deletedCount });
    } catch (error) {
      logger.warn("Cache clear failed", {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
    }
  }
};

const ChatbotCacheService = {
  getCachedAnswer,
  cacheAnswer,
  clearForUser,
};

export { ChatbotCacheService };

export type { CacheScope, CachedAnswer };
