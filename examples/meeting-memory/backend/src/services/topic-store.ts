import type { DetectedTopic, TopicUpdate } from "../types";

import { RedisDb } from "cau-redis";

import {
  COPILOT_KEY_PREFIX,
  COPILOT_TOPICS_PREFIX,
  COPILOT_KEY_SEPARATOR,
  DetectedTopicSource,
} from "../constants";
import { getAppState } from "../app-state";

const buildKey = (sessionId?: string): string => {
  const { namespace, userId } = getAppState();

  const parts = [
    COPILOT_KEY_PREFIX,
    COPILOT_TOPICS_PREFIX,
    namespace,
    userId,
    sessionId, //
    //optional , not passed during clearAll
  ].filter(Boolean) as string[];

  return parts.join(COPILOT_KEY_SEPARATOR);
};

const initialize = async (
  sessionId: string,
  topics: DetectedTopic[],
): Promise<void> => {
  const key = buildKey(sessionId);
  const redis = RedisDb.getInstance();
  await redis.jsonSet({ key, value: topics });
};

const get = async (sessionId: string): Promise<DetectedTopic[]> => {
  const key = buildKey(sessionId);
  const redis = RedisDb.getInstance();
  const result = await redis.jsonGet<DetectedTopic[]>({ key });

  return result ?? [];
};

const mergeUpdates = async (
  sessionId: string,
  updates: TopicUpdate[],
  chunkIndex: number,
): Promise<DetectedTopic[]> => {
  const current = await get(sessionId);

  for (const update of updates) {
    const existingIdx = current.findIndex(
      (t) => t.name.toLowerCase() === update.name.toLowerCase(),
    );
    const isExisting = existingIdx >= 0;

    if (isExisting) {
      current[existingIdx] = {
        ...current[existingIdx],
        status: update.status,
        detectedAtChunkIndex:
          current[existingIdx].detectedAtChunkIndex ?? chunkIndex,
        detectedAtTimestamp:
          current[existingIdx].detectedAtTimestamp ??
          update.detectedAtTimestamp,
      };
    } else {
      current.push({
        name: update.name,
        status: update.status,
        detectedAtChunkIndex: chunkIndex,
        detectedAtTimestamp: update.detectedAtTimestamp,
        source: DetectedTopicSource.AI_DETECTED,
      });
    }
  }

  const key = buildKey(sessionId);
  const redis = RedisDb.getInstance();
  await redis.jsonSet({ key, value: current });

  return current;
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

const TopicStore = { initialize, get, mergeUpdates, clear, clearAll };

export { TopicStore };
