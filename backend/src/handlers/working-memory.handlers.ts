import type { RouteHandler } from "cau-api-server";
import type {
  CreateWorkingMemoryInput,
  AppendWorkingMemoryInput,
  GetWorkingMemoryInput,
  DeleteWorkingMemoryInput,
  ListWorkingMemorySessionsInput,
  DetectedTopic,
} from "../types";

import { RedisAgentMemory, MessageRole } from "cau-ram";

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

const MEMORY_ROLE_TO_MESSAGE_ROLE: Record<string, string> = {
  user: MessageRole.USER,
  assistant: MessageRole.ASSISTANT,
};

const resolveMessageRole = (
  chunk: AppendWorkingMemoryInput["chunk"],
): string => {
  const { datasetConfig } = getAppState();
  const memoryRole = datasetConfig?.roleMapping?.[chunk.role] ?? "user";

  return MEMORY_ROLE_TO_MESSAGE_ROLE[memoryRole] ?? MessageRole.USER;
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
    history: [],
  }));
  await TopicStore.initialize(sessionId, seededTopics);
};

const createWorkingMemoryHandler: RouteHandler = async (input, { logger }) => {
  const { transcriptId } = input as CreateWorkingMemoryInput;

  const sessionId = buildSessionId(transcriptId);

  logger.info("Creating working memory session", {
    sessionId,
    transcriptId,
  });

  await seedTopicsFromTranscript(sessionId, transcriptId);
  await TranscriptChunkStore.initialize(sessionId);
  logger.info("Pre-seeded detected topics and initialized chunk store", {
    sessionId,
  });

  return { sessionId, created: true, memory: { events: [] } };
};

const appendWorkingMemoryHandler: RouteHandler = async (input, { logger }) => {
  const { sessionId, chunk, isLastChunk } = input as AppendWorkingMemoryInput;
  const { userId } = getAppState();
  const startMs = Date.now();

  const role = resolveMessageRole(chunk);
  const content = `[${chunk.timestamp}] ${chunk.speaker}: ${chunk.text}`;

  const event = await RedisAgentMemory.getInstance().addSessionEvent({
    sessionId,
    actorId: userId,
    role: role as any,
    content,
  });

  await TranscriptChunkStore.append(sessionId, chunk);

  const latencyMs = Date.now() - startMs;

  logger.info("Appended session event", {
    sessionId,
    eventId: event.eventId,
    isLastChunk,
    latencyMs,
  });

  return {
    eventId: event.eventId,
    latencyMs,
  };
};

/**
 createWorkingMemoryHandler generates the session ID and seeds local stores
 (topics, chunks) but does NOT call addSessionEvent on cloud RAM. The cloud
 only learns about a session after the first addSessionEvent during playback.
 If the user loads a created session before any messages are played,
 getSessionMemory returns null. Return an empty session in that case instead
 of throwing, since the session ID is legitimate. 
*/
const getWorkingMemoryHandler: RouteHandler = async (input, { logger }) => {
  const { sessionId } = input as GetWorkingMemoryInput;

  logger.info("Getting session memory", { sessionId });

  const result =
    await RedisAgentMemory.getInstance().getSessionMemory(sessionId);

  if (!result) {
    logger.info("Session memory not found, returning empty session", {
      sessionId,
    });
    return { sessionId, ownerId: "", events: [] };
  }

  return result;
};

const deleteWorkingMemoryHandler: RouteHandler = async (input, { logger }) => {
  const { sessionId } = input as DeleteWorkingMemoryInput;

  logger.info("Deleting session memory", { sessionId });

  await RedisAgentMemory.getInstance().deleteSessionMemory(sessionId);

  return { deleted: true, sessionId };
};

const listWorkingMemorySessionsHandler: RouteHandler = async (
  input,
  { logger },
) => {
  const { limit, offset } = (input as ListWorkingMemorySessionsInput) ?? {};

  const result = await RedisAgentMemory.getInstance().listSessions({
    limit: limit ?? DEFAULT_LIST_LIMIT,
    offset: offset ?? DEFAULT_LIST_OFFSET,
  });

  logger.info("Listing sessions", {
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
