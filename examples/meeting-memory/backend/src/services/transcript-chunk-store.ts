import type { TranscriptChunk } from "../types";

import { COPILOT_CHUNKS_PREFIX } from "../constants";

import { getItems, setItems, appendItem, countItems, clearItems, clearAllItems } from "./redis-json-store";

const ENTITY_PREFIX = COPILOT_CHUNKS_PREFIX;

const initialize = async (sessionId: string): Promise<void> => {
  await setItems(ENTITY_PREFIX, sessionId, []);
};

const append = async (
  sessionId: string,
  chunk: TranscriptChunk,
): Promise<void> => {
  await appendItem(ENTITY_PREFIX, sessionId, chunk);
};

const getRange = async (
  sessionId: string,
  startIndex: number,
  endIndex: number,
): Promise<TranscriptChunk[]> => {
  const chunks = await getItems<TranscriptChunk>(ENTITY_PREFIX, sessionId);

  return chunks.slice(startIndex, endIndex + 1);
};

const getAll = async (sessionId: string): Promise<TranscriptChunk[]> => {
  return getItems<TranscriptChunk>(ENTITY_PREFIX, sessionId);
};

const count = async (sessionId: string): Promise<number> => {
  return countItems(ENTITY_PREFIX, sessionId);
};

const clear = async (sessionId: string): Promise<void> => {
  await clearItems(ENTITY_PREFIX, sessionId);
};

const clearAll = async (): Promise<void> => {
  await clearAllItems(ENTITY_PREFIX);
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
