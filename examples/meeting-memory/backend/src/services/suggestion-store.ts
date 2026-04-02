import type { LiveSuggestion } from "../types";

import { RedisDb } from "cau-redis";

import {
  COPILOT_KEY_PREFIX,
  COPILOT_SUGGESTIONS_PREFIX,
  COPILOT_KEY_SEPARATOR,
} from "../constants";
import { getAppState } from "../app-state";

const buildKey = (sessionId?: string): string => {
  const { namespace, userId } = getAppState();

  const parts = [
    COPILOT_KEY_PREFIX,
    COPILOT_SUGGESTIONS_PREFIX,
    namespace,
    userId,
    sessionId, //optional , not passed during clearAll
  ].filter(Boolean) as string[];

  return parts.join(COPILOT_KEY_SEPARATOR);
};

const add = async (
  sessionId: string,
  suggestion: LiveSuggestion,
): Promise<void> => {
  const key = buildKey(sessionId);
  const redis = RedisDb.getInstance();
  const existing = await redis.jsonGet<LiveSuggestion[]>({ key });
  const current = existing ?? [];
  const updated = [...current, suggestion];
  await redis.jsonSet({ key, value: updated });
};

const list = async (sessionId: string): Promise<LiveSuggestion[]> => {
  const key = buildKey(sessionId);
  const redis = RedisDb.getInstance();
  const result = await redis.jsonGet<LiveSuggestion[]>({ key });

  return result ?? [];
};

const clear = async (sessionId: string): Promise<void> => {
  const key = buildKey(sessionId);
  const redis = RedisDb.getInstance();
  await redis.del({ keys: [key] });
};

const clearAll = async (): Promise<void> => {
  const prefix = buildKey();
  const redis = RedisDb.getInstance();
  let cursor = 0;
  let hasMore = true;
  while (hasMore) {
    const result = await redis.scan({
      cursor,
      pattern: `${prefix}*`,
      count: 100,
    });
    cursor = result.cursor;
    hasMore = cursor !== 0;
    for (const key of result.keys) {
      await redis.del({ keys: [key] });
    }
  }
};

const SuggestionStore = { add, list, clear, clearAll };

export { SuggestionStore };
