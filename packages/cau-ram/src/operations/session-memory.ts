import type { SessionEventInput, SessionEvent, SessionMemory, SessionListOptions, SessionListResult } from "../types";

import { AgentMemory } from "@redis-ai/agent-memory";

import { DEFAULT_LIST_LIMIT, DEFAULT_LIST_OFFSET } from "../constants";

const mapContentToSdkFormat = (content: string): Array<{ text: string }> => {
  return [{ text: content }];
};

const mapSdkContentToString = (content: Array<{ text: string }>): string => {
  return content.map((c) => c.text).join("");
};

const mapSdkEventToSessionEvent = (sdkEvent: {
  eventId: string;
  sessionId: string;
  actorId: string;
  role: string;
  content: Array<{ text: string }>;
  createdAt: number;
  metadata?: unknown;
}): SessionEvent => {
  return {
    eventId: sdkEvent.eventId,
    sessionId: sdkEvent.sessionId,
    actorId: sdkEvent.actorId,
    role: sdkEvent.role as SessionEvent["role"],
    content: mapSdkContentToString(sdkEvent.content),
    createdAt: sdkEvent.createdAt,
    metadata: sdkEvent.metadata as Record<string, unknown> | undefined,
  };
};

const addSessionEvent = async (
  client: AgentMemory,
  input: SessionEventInput,
): Promise<SessionEvent> => {
  const createdAt = input.createdAt ?? Date.now();
  const response = await client.addSessionEvent({
    sessionId: input.sessionId,
    actorId: input.actorId,
    role: input.role as any,
    content: mapContentToSdkFormat(input.content),
    createdAt,
    metadata: input.metadata,
  });

  return mapSdkEventToSessionEvent(response.event);
};

const getSessionMemory = async (
  client: AgentMemory,
  sessionId: string,
): Promise<SessionMemory | null> => {
  let result: SessionMemory | null = null;

  try {
    const response = await client.getSessionMemory(sessionId);

    result = {
      sessionId: response.sessionId,
      ownerId: response.ownerId,
      events: response.events.map(mapSdkEventToSessionEvent),
    };
  } catch (error: any) {
    const isNotFound = error?.statusCode === 404 || error?.message?.includes("not found");
    if (!isNotFound) {
      throw error;
    }
  }

  return result;
};

const deleteSessionMemory = async (
  client: AgentMemory,
  sessionId: string,
): Promise<void> => {
  await client.deleteSessionMemory(sessionId);
};

const getSessionEvent = async (
  client: AgentMemory,
  sessionId: string,
  eventId: string,
): Promise<SessionEvent> => {
  const response = await client.getSessionEvent(sessionId, eventId);

  return mapSdkEventToSessionEvent(response.event);
};

const deleteSessionEvent = async (
  client: AgentMemory,
  sessionId: string,
  eventId: string,
): Promise<void> => {
  await client.deleteSessionEvent(sessionId, eventId);
};

const listSessions = async (
  client: AgentMemory,
  options?: SessionListOptions,
): Promise<SessionListResult> => {
  const limit = options?.limit ?? DEFAULT_LIST_LIMIT;
  const offset = options?.offset ?? DEFAULT_LIST_OFFSET;

  const response = await client.listSessions(limit, offset);

  return {
    sessions: response.sessions,
    total: response.total,
  };
};

export { addSessionEvent, getSessionMemory, getSessionEvent, deleteSessionEvent, deleteSessionMemory, listSessions };
