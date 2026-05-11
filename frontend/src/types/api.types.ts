import type { MemoryRecordData } from "./memory.types";

type ApiResponse<T> = { data: T; error: null } | { data: null; error: string };

type HealthResponse = {
  status: string;
  uptime: number;
};

type LtSearchResponse = {
  memories: MemoryRecordData[];
  total: number;
};

type TaskResponse = {
  id: string;
  status: string;
  result: unknown;
};

type ListSessionsResponse = {
  sessions: string[];
  total: number;
};

type DeleteWorkingMemoryResponse = {
  deleted: boolean;
  sessionId: string;
};

type ResetResult = {
  sessionsDeleted: number;
  memoriesDeleted: number;
};

export type {
  ApiResponse,
  DeleteWorkingMemoryResponse,
  HealthResponse,
  ListSessionsResponse,
  LtSearchResponse,
  ResetResult,
  TaskResponse,
};
