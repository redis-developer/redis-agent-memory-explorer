import type { MemoryRecordData } from "./memory.types";

type ApiResponse<T> = { data: T; error: null } | { data: null; error: string };

type HealthResponse = {
  status: string;
  uptime: number;
  timestamp: string;
};

type LtSearchResponse = {
  memories: MemoryRecordData[];
  total: number;
  nextOffset: number | null;
};

type TaskResponse = {
  id: string;
  status: string;
  result: unknown;
};

type ResetResult = {
  sessionsDeleted: number;
  memoriesDeleted: number;
  viewsDeleted: number;
  viewsCreated: number;
};

export type {
  ApiResponse,
  HealthResponse,
  LtSearchResponse,
  ResetResult,
  TaskResponse,
};
