import type { TranscriptChunk } from "../types";

import { RedisDb } from "cau-redis";

import {
  COPILOT_KEY_PREFIX,
  COPILOT_CHUNKS_PREFIX,
  COPILOT_KEY_SEPARATOR,
  REDIS_JSON_ROOT_PATH,
} from "../constants";
import { getAppState } from "../app-state";

const buildKey = (sessionId?: string): string => {
  const { namespace, userId } = getAppState();

  const parts = [
    COPILOT_KEY_PREFIX,
    COPILOT_CHUNKS_PREFIX,
    namespace,
    userId,
    sessionId, //optional , not passed during clearAll
  ].filter(Boolean) as string[];

  return parts.join(COPILOT_KEY_SEPARATOR);
};

const initialize = async (sessionId: string): Promise<void> => {
  const key = buildKey(sessionId);
  const redis = RedisDb.getInstance();
  await redis.jsonSet({ key, value: [] });
};

const append = async (
  sessionId: string,
  chunk: TranscriptChunk,
): Promise<void> => {
  const key = buildKey(sessionId);
  const redis = RedisDb.getInstance();
  await redis.jsonArrAppend({
    key,
    path: REDIS_JSON_ROOT_PATH,
    values: [chunk],
  });
};

const getRange = async (
  sessionId: string,
  startIndex: number,
  endIndex: number,
): Promise<TranscriptChunk[]> => {
  const key = buildKey(sessionId);
  const redis = RedisDb.getInstance();
  const all = await redis.jsonGet<TranscriptChunk[]>({ key });
  const chunks = all ?? [];

  return chunks.slice(startIndex, endIndex + 1);
};

const getAll = async (sessionId: string): Promise<TranscriptChunk[]> => {
  const key = buildKey(sessionId);
  const redis = RedisDb.getInstance();
  const result = await redis.jsonGet<TranscriptChunk[]>({ key });

  return result ?? [];
};

const count = async (sessionId: string): Promise<number> => {
  const all = await getAll(sessionId);

  return all.length;
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

const TranscriptChunkStore = {
  initialize,
  append,
  getRange,
  getAll,
  count,
  clear,
  clearAll,
};

export { TranscriptChunkStore };
