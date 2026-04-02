import type {
  TranscriptChunk,
  DetectedTopic,
  DatasetConfig,
  LiveSuggestion,
  SuggestionLlmResponse,
  TopicUpdate,
  GenerateSuggestionResult,
} from "../types";

import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { AgentMemory } from "cau-redis-agent-memory";

import { SUGGESTION_CHUNK_WINDOW } from "../constants";
import { ENV } from "../config";
import { getAppState } from "../app-state";
import { buildSuggestionSystemPrompt } from "./system-prompt";
import { extractSearchQuery } from "./query-extraction";
import { TranscriptChunkStore } from "../services/transcript-chunk-store";
import { TopicStore } from "../services/topic-store";
import { SuggestionStore } from "../services/suggestion-store";

const formatRecentChunks = (chunks: TranscriptChunk[]): string => {
  return chunks
    .map((c) => `[${c.timestamp}] ${c.speaker} (${c.role}): ${c.text}`)
    .join("\n");
};

const parseLlmResponse = (content: string): SuggestionLlmResponse => {
  let cleaned = content.trim();
  const hasCodeFence = cleaned.startsWith("```");
  if (hasCodeFence) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = JSON.parse(cleaned) as SuggestionLlmResponse;
  const suggestion = parsed.suggestion ?? null;
  const topicUpdates = parsed.topicUpdates ?? [];

  return { suggestion, topicUpdates };
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
  const { namespace, userId } = getAppState();
  //convert recent chunks to query and search existing AMS memory
  const extractedQuery = await extractSearchQuery(recentChunks);
  const memoryContext = await AgentMemory.getInstance().memoryPrompt({
    query: extractedQuery,
    session: {
      sessionId,
      userId,
      modelName: ENV.MODEL_NAME,
      contextWindowMax: ENV.CONTEXT_WINDOW_MAX,
    },
    longTermSearch: {
      namespace: { eq: namespace },
      userId: { eq: userId },
    },
  });

  return JSON.stringify(memoryContext);
};

const invokeSuggestionLlm = async (
  datasetConfig: DatasetConfig,
  detectedTopics: DetectedTopic[],
  previousSuggestions: LiveSuggestion[],
  recentChunks: TranscriptChunk[],
  memoryContext: string,
): Promise<SuggestionLlmResponse> => {
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

  //systemPrompt(topics, previousSuggestions), memoryContext, recentChunks are passed to the LLM to generate suggestion
  const result = await llm.invoke([
    new SystemMessage(systemPrompt),
    new SystemMessage(`Memory context:\n${memoryContext}`),
    new HumanMessage(formatRecentChunks(recentChunks)),
  ]);

  return parseLlmResponse(result.content as string);
};

const persistSuggestion = async (
  sessionId: string,
  parsed: SuggestionLlmResponse,
  chunkIndex: number,
  recentChunks: TranscriptChunk[],
): Promise<LiveSuggestion | null> => {
  let liveSuggestion: LiveSuggestion | null = null;

  const hasSuggestion = parsed.suggestion !== null;
  if (hasSuggestion) {
    const lastChunk = recentChunks[recentChunks.length - 1];
    liveSuggestion = {
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

    await SuggestionStore.add(sessionId, liveSuggestion);
  }

  return liveSuggestion;
};

const persistTopicUpdates = async (
  sessionId: string,
  parsed: SuggestionLlmResponse,
  chunkIndex: number,
  recentChunks: TranscriptChunk[],
): Promise<DetectedTopic[]> => {
  const lastChunkTimestamp =
    recentChunks[recentChunks.length - 1]?.timestamp ?? null;
  const topicUpdates: TopicUpdate[] = (parsed.topicUpdates ?? []).map(
    (update) => ({
      ...update,
      detectedAtTimestamp: lastChunkTimestamp,
    }),
  );

  return TopicStore.mergeUpdates(sessionId, topicUpdates, chunkIndex);
};

const generateSuggestion = async (
  sessionId: string,
  chunkIndex: number,
  datasetConfig: DatasetConfig,
): Promise<GenerateSuggestionResult> => {
  const { recentChunks, detectedTopics } = await fetchRecentChunksAndTopics(
    sessionId,
    chunkIndex,
  );

  let liveSuggestion: LiveSuggestion | null = null;
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

    liveSuggestion = await persistSuggestion(
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
  }

  return { suggestion: liveSuggestion, detectedTopics: updatedTopics };
};

export { generateSuggestion };
