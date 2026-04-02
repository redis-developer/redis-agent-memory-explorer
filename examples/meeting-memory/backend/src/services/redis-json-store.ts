import { RedisDb } from "cau-redis";

import {
  COPILOT_KEY_PREFIX,
  COPILOT_KEY_SEPARATOR,
  REDIS_JSON_ROOT_PATH,
} from "../constants";
import { getAppState } from "../app-state";

const SCAN_BATCH_SIZE = 100;

const buildStoreKey = (entityPrefix: string, sessionId?: string): string => {
  const { namespace, userId } = getAppState();

  const parts = [
    COPILOT_KEY_PREFIX,
    entityPrefix,
    namespace,
    userId,
    sessionId, //optional ,say not passed during clearAll
  ].filter(Boolean) as string[];

  return parts.join(COPILOT_KEY_SEPARATOR);
};

const getItems = async <T>(
  entityPrefix: string,
  sessionId: string,
): Promise<T[]> => {
  const key = buildStoreKey(entityPrefix, sessionId);
  const redis = RedisDb.getInstance();
  const result = await redis.jsonGet<T[]>({ key });

  return result ?? [];
};

const setItems = async <T>(
  entityPrefix: string,
  sessionId: string,
  items: T[],
): Promise<void> => {
  const key = buildStoreKey(entityPrefix, sessionId);
  const redis = RedisDb.getInstance();
  await redis.jsonSet({ key, value: items });
};

const appendItem = async <T>(
  entityPrefix: string,
  sessionId: string,
  item: T,
): Promise<void> => {
  const key = buildStoreKey(entityPrefix, sessionId);
  const redis = RedisDb.getInstance();
  await redis.jsonArrAppend({
    key,
    path: REDIS_JSON_ROOT_PATH,
    values: [item],
  });
};

const clearItems = async (
  entityPrefix: string,
  sessionId: string,
): Promise<void> => {
  const key = buildStoreKey(entityPrefix, sessionId);
  const redis = RedisDb.getInstance();
  await redis.del({ keys: [key] });
};

const countItems = async (
  entityPrefix: string,
  sessionId: string,
): Promise<number> => {
  const key = buildStoreKey(entityPrefix, sessionId);
  const redis = RedisDb.getInstance();
  const client = redis.getClient();
  const result = await client.json.arrLen(key, { path: REDIS_JSON_ROOT_PATH });

  let length = result;
  if (Array.isArray(result)) {
    length = result[0] ?? 0;
  }

  return length as number;
};

const clearAllItems = async (entityPrefix: string): Promise<void> => {
  const prefix = buildStoreKey(entityPrefix);
  const redis = RedisDb.getInstance();
  let cursor = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await redis.scan({
      cursor,
      pattern: `${prefix}*`,
      count: SCAN_BATCH_SIZE,
    });
    cursor = result.cursor;
    hasMore = cursor !== 0;

    for (const key of result.keys) {
      await redis.del({ keys: [key] });
    }
  }
};

export {
  buildStoreKey,
  getItems,
  setItems,
  appendItem,
  countItems,
  clearItems,
  clearAllItems,
};
