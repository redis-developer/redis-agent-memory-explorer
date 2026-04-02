import type { RouteHandler } from "cau-api-server";
import type {
  CreateWorkingMemoryInput,
  AppendWorkingMemoryInput,
  GetWorkingMemoryInput,
  DeleteWorkingMemoryInput,
  ListWorkingMemorySessionsInput,
  DetectedTopic,
} from "../types";

import { AgentMemory, ExtractionStrategy } from "cau-redis-agent-memory";

import {
  SESSION_ID_PREFIX,
  DEFAULT_LIST_LIMIT,
  DEFAULT_LIST_OFFSET,
  DetectedTopicStatus,
  DetectedTopicSource,
} from "../constants";
import { getAppState } from "../app-state";
import { ENV } from "../config";
import { TranscriptChunkStore } from "../services/transcript-chunk-store";
import { TopicStore } from "../services/topic-store";
import { TranscriptLoaderService } from "../services/transcript-loader.service";

const buildSessionId = (transcriptId: string): string => {
  return `${SESSION_ID_PREFIX}-${transcriptId}-${Date.now()}`;
};

const formatChunkAsMessage = (chunk: AppendWorkingMemoryInput["chunk"]): {
  role: string;
  content: string;
} => {
  return {
    role: "user",
    content: `[${chunk.timestamp}] ${chunk.speaker}: ${chunk.text}`,
  };
};

const seedTopicsFromTranscript = async (
  sessionId: string,
  transcriptId: string,
): Promise<void> => {
  const transcript = TranscriptLoaderService.loadTranscript(
    ENV.ACTIVE_DATASET,
    transcriptId,
  );
  const topics = transcript.meeting.summary.topics ?? [];
  const seededTopics: DetectedTopic[] = topics.map((name) => ({
    name,
    status: DetectedTopicStatus.PENDING,
    detectedAtChunkIndex: null,
    detectedAtTimestamp: null,
    source: DetectedTopicSource.PRE_SEEDED,
  }));
  await TopicStore.initialize(sessionId, seededTopics);
};

const createWorkingMemoryHandler: RouteHandler = async (input, { logger }) => {
  const { transcriptId } = input as CreateWorkingMemoryInput;
  const { namespace, userId } = getAppState();

  const sessionId = buildSessionId(transcriptId);

  logger.info("Creating working memory session", {
    sessionId,
    transcriptId,
  });

  const { created, memory } =
    await AgentMemory.getInstance().getOrCreateWorkingMemory(sessionId, {
      userId,
      namespace,
    });

  await seedTopicsFromTranscript(sessionId, transcriptId);
  await TranscriptChunkStore.initialize(sessionId);
  logger.info("Pre-seeded detected topics and initialized chunk store", { sessionId });

  return { sessionId, created, memory };
};

const appendWorkingMemoryHandler: RouteHandler = async (input, { logger }) => {
  const { sessionId, chunk, isLastChunk } = input as AppendWorkingMemoryInput;
  const { namespace, userId } = getAppState();
  const startMs = Date.now();

  const existing = await AgentMemory.getInstance().getWorkingMemory(
    sessionId,
    { userId, namespace },
  );

  const currentMessages = existing?.messages ?? [];
  const newMessage = formatChunkAsMessage(chunk);
  const allMessages = [...currentMessages, newMessage];

  const payload: Parameters<typeof AgentMemory.prototype.putWorkingMemory>[1] =
    {
      messages: allMessages,
      context: existing?.context ?? undefined,
      userId,
      namespace,
    };

  const shouldTriggerExtraction = isLastChunk;
  if (shouldTriggerExtraction) {
    payload.longTermMemoryStrategy = {
      strategy: ExtractionStrategy.DISCRETE,
    };
    logger.info("Last chunk -- triggering long-term memory extraction", {
      sessionId,
    });
  }

  const result = await AgentMemory.getInstance().putWorkingMemory(
    sessionId,
    payload,
    { namespace, modelName: ENV.MODEL_NAME, contextWindowMax: ENV.CONTEXT_WINDOW_MAX },
  );

  await TranscriptChunkStore.append(sessionId, chunk);

  const latencyMs = Date.now() - startMs;

  logger.info("Appended to working memory", {
    sessionId,
    messageCount: result.messages.length,
    tokens: result.tokens,
    isLastChunk,
    latencyMs,
  });

  return {
    messageCount: result.messages.length,
    tokens: result.tokens,
    context: result.context,
    contextPercentageTotalUsed: result.contextPercentageTotalUsed,
    contextPercentageUntilSummarization:
      result.contextPercentageUntilSummarization,
    latencyMs,
  };
};

const getWorkingMemoryHandler: RouteHandler = async (input, { logger }) => {
  const { sessionId } = input as GetWorkingMemoryInput;
  const { namespace, userId } = getAppState();

  logger.info("Getting working memory", { sessionId });

  const result = await AgentMemory.getInstance().getWorkingMemory(sessionId, {
    userId,
    namespace,
  });

  const isNotFound = result === null;
  if (isNotFound) {
    throw new Error(`Working memory session not found: ${sessionId}`);
  }

  return result;
};

const deleteWorkingMemoryHandler: RouteHandler = async (input, { logger }) => {
  const { sessionId } = input as DeleteWorkingMemoryInput;
  const { namespace, userId } = getAppState();

  logger.info("Deleting working memory", { sessionId });

  const result = await AgentMemory.getInstance().deleteWorkingMemory(
    sessionId,
    { namespace, userId },
  );

  return result;
};

const listWorkingMemorySessionsHandler: RouteHandler = async (
  input,
  { logger },
) => {
  const { limit, offset } = (input as ListWorkingMemorySessionsInput) ?? {};
  const { namespace, userId } = getAppState();

  const result = await AgentMemory.getInstance().listSessions({
    namespace,
    userId,
    limit: limit ?? DEFAULT_LIST_LIMIT,
    offset: offset ?? DEFAULT_LIST_OFFSET,
  });

  logger.info("Listing working memory sessions", {
    count: result.sessions.length,
    total: result.total,
  });

  return result;
};

export {
  createWorkingMemoryHandler,
  appendWorkingMemoryHandler,
  getWorkingMemoryHandler,
  deleteWorkingMemoryHandler,
  listWorkingMemorySessionsHandler,
};
