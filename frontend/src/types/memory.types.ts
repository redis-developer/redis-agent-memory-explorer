import type { MemoryType } from "@/constants/app.constants";

type SessionEvent = {
  eventId: string;
  sessionId: string;
  actorId: string;
  role: string;
  content: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
};

type SessionMemoryData = {
  sessionId: string;
  ownerId: string;
  events: SessionEvent[];
};

type MemoryRecordData = {
  id: string;
  text: string;
  memoryType?: MemoryType;
  sessionId?: string;
  ownerId?: string;
  namespace?: string;
  topics?: string[];
  entities?: string[];
  eventDate?: string;
  createdAt: number;
  updatedAt: number;
};

type AppendResult = {
  eventId: string;
  latencyMs: number;
};

type CreateSessionResponse = {
  sessionId: string;
  created: boolean;
  memory: { events: SessionEvent[] };
};

export type {
  SessionEvent,
  SessionMemoryData,
  MemoryRecordData,
  AppendResult,
  CreateSessionResponse,
};
