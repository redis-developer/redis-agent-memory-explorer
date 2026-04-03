import type { DetectedTopic, TopicUpdate } from "../types";

import {
  COPILOT_TOPICS_PREFIX,
  DetectedTopicSource,
} from "../constants";

import { getItems, setItems, clearItems, clearAllItems } from "./redis-json-store";

const ENTITY_PREFIX = COPILOT_TOPICS_PREFIX;

const initialize = async (
  sessionId: string,
  topics: DetectedTopic[],
): Promise<void> => {
  await setItems(ENTITY_PREFIX, sessionId, topics);
};

const get = async (sessionId: string): Promise<DetectedTopic[]> => {
  return getItems<DetectedTopic>(ENTITY_PREFIX, sessionId);
};

const mergeUpdates = async (
  sessionId: string,
  updates: TopicUpdate[],
  chunkIndex: number,
): Promise<DetectedTopic[]> => {
  const current = await getItems<DetectedTopic>(ENTITY_PREFIX, sessionId);

  for (const update of updates) {
    const existingIdx = current.findIndex(
      (t) => t.name.toLowerCase() === update.name.toLowerCase(),
    );
    const isExisting = existingIdx >= 0;

    if (isExisting) {
      const prev = current[existingIdx];
      const isFirstDetection = prev.detectedAtChunkIndex === null;

      const history = isFirstDetection
        ? prev.history
        : [
            ...prev.history,
            {
              chunkIndex,
              timestamp: update.detectedAtTimestamp,
              status: update.status,
            },
          ];

      current[existingIdx] = {
        ...prev,
        status: update.status,
        detectedAtChunkIndex: prev.detectedAtChunkIndex ?? chunkIndex,
        detectedAtTimestamp:
          prev.detectedAtTimestamp ?? update.detectedAtTimestamp,
        history,
      };
    } else {
      current.push({
        name: update.name,
        status: update.status,
        detectedAtChunkIndex: chunkIndex,
        detectedAtTimestamp: update.detectedAtTimestamp,
        source: DetectedTopicSource.AI_DETECTED,
        history: [],
      });
    }
  }

  await setItems(ENTITY_PREFIX, sessionId, current);

  return current;
};

const clear = async (sessionId: string): Promise<void> => {
  await clearItems(ENTITY_PREFIX, sessionId);
};

const clearAll = async (): Promise<void> => {
  await clearAllItems(ENTITY_PREFIX);
};

const TopicStore = { initialize, get, mergeUpdates, clear, clearAll };

export { TopicStore };
