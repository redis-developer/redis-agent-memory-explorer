import type {
  TranscriptChunk,
  DetectedTopic,
  DatasetConfig,
  Suggestion,
  SuggestionLlmResponse,
  TopicUpdate,
  GenerateSuggestionResult,
} from "../types";

import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { RedisAgentMemory } from "cau-ram";
import { Logger } from "cau-logger";

import { SUGGESTION_CHUNK_WINDOW, DetectedTopicStatus } from "../constants";
import { ENV } from "../config";
import { getAppState } from "../app-state";
import { buildSuggestionSystemPrompt } from "./system-prompt";
import { extractSearchQuery } from "./query-extraction";
import { TranscriptChunkStore } from "../services/transcript-chunk-store";
import { TopicStore } from "../services/topic-store";
import { SuggestionStore } from "../services/suggestion-store";

let _logger: ReturnType<typeof Logger.getInstance> | null = null;
const getLogger = () => {
  if (!_logger)
    _logger = Logger.getInstance().child({ component: "SuggestionAgent" });
  return _logger;
};

const formatRecentChunks = (chunks: TranscriptChunk[]): string => {
  return chunks
    .map((c) => `[${c.timestamp}] ${c.speaker} (${c.role}): ${c.text}`)
    .join("\n");
};

const parseLlmResponse = (content: string): SuggestionLlmResponse => {
  const logger = getLogger();
  let cleaned = content.trim();
  const hasCodeFence = cleaned.startsWith("```");
  if (hasCodeFence) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const parsed = JSON.parse(cleaned);
    const isValidObject = parsed !== null && typeof parsed === "object";
    const suggestion = isValidObject ? (parsed.suggestion ?? null) : null;
    const topicUpdates = isValidObject ? (parsed.topicUpdates ?? []) : [];

    return { suggestion, topicUpdates };
  } catch (err) {
    logger.warn("Failed to parse LLM suggestion response as JSON", {
      error: (err as Error).message,
      contentLength: content.length,
    });
    return { suggestion: null, topicUpdates: [] };
  }
};

const fetchRecentChunksAndTopics = async (
  sessionId: string,
  chunkIndex: number,
): Promise<{
  recentChunks: TranscriptChunk[];
  detectedTopics: DetectedTopic[];
}> => {
  const startIdx = Math.max(0, chunkIndex - SUGGESTION_CHUNK_WINDOW + 1);
  const recentChunks = await TranscriptChunkStore.getRange(
    sessionId,
    startIdx,
    chunkIndex,
  );
  const detectedTopics = await TopicStore.get(sessionId);

  return { recentChunks, detectedTopics };
};

const fetchMemoryContext = async (
  sessionId: string,
  recentChunks: TranscriptChunk[],
): Promise<string> => {
  const { userId } = getAppState();
  const logger = getLogger();

  const queryStartMs = Date.now();
  const extractedQuery = await extractSearchQuery(recentChunks);
  logger.info("Search query extracted from chunks", {
    sessionId,
    chunkCount: recentChunks.length,
    extractedQuery,
    latencyMs: Date.now() - queryStartMs,
  });

  const contextStartMs = Date.now();
  const memoryContext = await RedisAgentMemory.getInstance().buildMemoryPrompt({
    query: extractedQuery,
    sessionId,
    ownerId: userId,
    longTermSearch: true,
  });
  logger.info("Memory context hydrated via buildMemoryPrompt", {
    sessionId,
    latencyMs: Date.now() - contextStartMs,
  });

  return JSON.stringify(memoryContext);
};

const invokeSuggestionLlm = async (
  datasetConfig: DatasetConfig,
  detectedTopics: DetectedTopic[],
  previousSuggestions: Suggestion[],
  recentChunks: TranscriptChunk[],
  memoryContext: string,
): Promise<SuggestionLlmResponse> => {
  const logger = getLogger();
  const systemPrompt = buildSuggestionSystemPrompt(
    datasetConfig,
    detectedTopics,
    previousSuggestions,
  );

  const llm = new ChatOpenAI({
    model: ENV.CHATBOT_MODEL,
    temperature: 0,
    apiKey: ENV.OPENAI_API_KEY,
  });

  logger.info("Invoking suggestion LLM", {
    model: ENV.CHATBOT_MODEL,
    topicCount: detectedTopics.length,
    previousSuggestionCount: previousSuggestions.length,
    chunkCount: recentChunks.length,
  });

  const llmStartMs = Date.now();
  const result = await llm.invoke([
    new SystemMessage(systemPrompt),
    new SystemMessage(`Memory context:\n${memoryContext}`),
    new HumanMessage(formatRecentChunks(recentChunks)),
  ]);
  logger.info("Suggestion LLM responded", {
    latencyMs: Date.now() - llmStartMs,
  });

  return parseLlmResponse(result.content as string);
};

const persistSuggestion = async (
  sessionId: string,
  parsed: SuggestionLlmResponse,
  chunkIndex: number,
  recentChunks: TranscriptChunk[],
): Promise<Suggestion | null> => {
  let suggestion: Suggestion | null = null;

  const hasSuggestion = parsed.suggestion !== null;
  if (hasSuggestion) {
    const lastChunk = recentChunks[recentChunks.length - 1];
    suggestion = {
      id: `sug-${Date.now()}-${chunkIndex}`,
      type: parsed.suggestion!.type,
      title: parsed.suggestion!.title,
      summary: parsed.suggestion!.summary,
      details: parsed.suggestion!.details ?? [],
      chunkIndex,
      timestamp: lastChunk?.timestamp ?? "",
      relatedTopics: parsed.suggestion!.relatedTopics ?? [],
      createdAt: new Date().toISOString(),
    };

    await SuggestionStore.add(sessionId, suggestion);
  }

  return suggestion;
};

// Reconciles LLM-reported topic updates with the stored topic state.
//
// Two sources of topic signals come from the LLM response:
//   1. `parsed.topicUpdates` -- explicit status changes the LLM reported
//      (e.g., "Bond funds" moved to "question").
//   2. `parsed.suggestion.relatedTopics` -- topic names the suggestion
//      references but the LLM may not have included in topicUpdates.
//
// We treat relatedTopics as implicit "discussed" signals: if a suggestion
// mentions a topic that isn't already in topicUpdates, we synthesize a
// TopicUpdate for it so the topic store marks it as discussed.
//
// All updates are then forwarded to TopicStore.mergeUpdates, which handles:
//   - first-detection: fills detectedAt* fields (nullish coalescing)
//   - re-mention: appends to the topic's history array
//   - new topics: creates them with source "ai-detected"
const persistTopicUpdates = async (
  sessionId: string,
  parsed: SuggestionLlmResponse,
  chunkIndex: number,
  recentChunks: TranscriptChunk[],
): Promise<DetectedTopic[]> => {
  // Use the last chunk's transcript timestamp as the detection time
  const lastChunkTimestamp =
    recentChunks[recentChunks.length - 1]?.timestamp ?? null;

  // Source 1: explicit topic updates from the LLM, stamped with chunk time
  const topicUpdates: TopicUpdate[] = (parsed.topicUpdates ?? []).map(
    (update) => ({
      ...update,
      detectedAtTimestamp: lastChunkTimestamp,
    }),
  );

  // Source 2: relatedTopics from the suggestion that the LLM didn't
  // explicitly include in topicUpdates -- treated as "discussed"
  const relatedTopics: string[] = parsed.suggestion?.relatedTopics ?? [];
  const updatedNames = new Set(topicUpdates.map((u) => u.name.toLowerCase()));

  const missingTopics: TopicUpdate[] = relatedTopics
    .filter((name) => !updatedNames.has(name.toLowerCase()))
    .map((name) => ({
      name,
      status: DetectedTopicStatus.DISCUSSED,
      detectedAtTimestamp: lastChunkTimestamp,
    }));

  // Merge both sources and persist via TopicStore
  const mergedUpdates = [...topicUpdates, ...missingTopics];

  return TopicStore.mergeUpdates(sessionId, mergedUpdates, chunkIndex);
};

const generateSuggestion = async (
  sessionId: string,
  chunkIndex: number,
  datasetConfig: DatasetConfig,
): Promise<GenerateSuggestionResult> => {
  const logger = getLogger();
  const pipelineStartMs = Date.now();

  logger.info("Suggestion pipeline started", { sessionId, chunkIndex });

  const { recentChunks, detectedTopics } = await fetchRecentChunksAndTopics(
    sessionId,
    chunkIndex,
  );

  let suggestion: Suggestion | null = null;
  let updatedTopics = detectedTopics;

  const hasChunks = recentChunks.length > 0;
  if (hasChunks) {
    const previousSuggestions = await SuggestionStore.list(sessionId);
    const memoryContext = await fetchMemoryContext(sessionId, recentChunks);

    //generate suggestion
    const parsed = await invokeSuggestionLlm(
      datasetConfig,
      detectedTopics,
      previousSuggestions,
      recentChunks,
      memoryContext,
    );

    suggestion = await persistSuggestion(
      sessionId,
      parsed,
      chunkIndex,
      recentChunks,
    );
    updatedTopics = await persistTopicUpdates(
      sessionId,
      parsed,
      chunkIndex,
      recentChunks,
    );
  } else {
    logger.debug("Skipping suggestion — no recent chunks", {
      sessionId,
      chunkIndex,
    });
  }

  logger.info("Suggestion pipeline completed", {
    sessionId,
    chunkIndex,
    hasSuggestion: suggestion !== null,
    topicCount: updatedTopics.length,
    totalLatencyMs: Date.now() - pipelineStartMs,
  });

  return { suggestion: suggestion, detectedTopics: updatedTopics };
};

export { generateSuggestion };
