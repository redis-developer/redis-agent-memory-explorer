import type { LiveSuggestion } from "../types";

import { Logger } from "cau-logger";

import { COPILOT_SUGGESTIONS_PREFIX } from "../constants";

import {
  getItems,
  setItems,
  clearItems,
  clearAllItems,
} from "./redis-json-store";

let _logger: ReturnType<typeof Logger.getInstance> | null = null;
const getLogger = () => {
  if (!_logger)
    _logger = Logger.getInstance().child({ component: "SuggestionStore" });
  return _logger;
};

const ENTITY_PREFIX = COPILOT_SUGGESTIONS_PREFIX;

const add = async (
  sessionId: string,
  suggestion: LiveSuggestion,
): Promise<void> => {
  const logger = getLogger();
  const current = await getItems<LiveSuggestion>(ENTITY_PREFIX, sessionId);
  const updated = [...current, suggestion];
  await setItems(ENTITY_PREFIX, sessionId, updated);
  logger.info("Suggestion stored", {
    sessionId,
    suggestionId: suggestion.id,
    type: suggestion.type,
    totalCount: updated.length,
  });
};

const list = async (sessionId: string): Promise<LiveSuggestion[]> => {
  return getItems<LiveSuggestion>(ENTITY_PREFIX, sessionId);
};

const clear = async (sessionId: string): Promise<void> => {
  await clearItems(ENTITY_PREFIX, sessionId);
};

const clearAll = async (): Promise<void> => {
  await clearAllItems(ENTITY_PREFIX);
};

const SuggestionStore = { add, list, clear, clearAll };

export { SuggestionStore };
