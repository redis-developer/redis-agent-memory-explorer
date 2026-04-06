import type { RouteHandler } from "cau-api-server";
import type { GenerateSuggestionInput, ListSuggestionsInput } from "../types";

import { getAppState } from "../app-state";
import { generateSuggestion } from "../suggestion-agent";
import { SuggestionStore } from "../services/suggestion-store";
import { TopicStore } from "../services/topic-store";

const generateSuggestionHandler: RouteHandler = async (input, { logger }) => {
  const { sessionId, chunkIndex } = input as GenerateSuggestionInput;
  const { datasetConfig } = getAppState();

  logger.info("Generating suggestion", { sessionId, chunkIndex });

  const startMs = Date.now();
  const result = await generateSuggestion(sessionId, chunkIndex, datasetConfig!);

  const hasSuggestion = result.suggestion !== null;
  logger.info("Suggestion generation complete", {
    sessionId,
    chunkIndex,
    hasSuggestion,
    suggestionType: result.suggestion?.type ?? null,
    topicCount: result.detectedTopics.length,
    latencyMs: Date.now() - startMs,
  });

  return {
    suggestion: result.suggestion,
    detectedTopics: result.detectedTopics,
  };
};

const listSuggestionsHandler: RouteHandler = async (input, { logger }) => {
  const { sessionId } = input as ListSuggestionsInput;

  logger.info("Listing suggestions", { sessionId });

  const suggestions = await SuggestionStore.list(sessionId);
  const detectedTopics = await TopicStore.get(sessionId);

  return {
    suggestions,
    detectedTopics,
    total: suggestions.length,
  };
};

export { generateSuggestionHandler, listSuggestionsHandler };
