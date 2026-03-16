"use client";

import type { MemoryRecordData } from "@/types/memory.types";

import { useState, useEffect, useCallback, useRef } from "react";

import {
  searchLongTermMemoryBySession,
  searchLongTermMemory,
} from "@/services/api.service";
import { EXTRACTION_POLL_INTERVAL_MS } from "@/constants/app.constants";

type UseLongTermMemoryResult = {
  memories: MemoryRecordData[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  searchByText: (query: string) => void;
};

const useLongTermMemory = (
  sessionId: string | null,
): UseLongTermMemoryResult => {
  const [memories, setMemories] = useState<MemoryRecordData[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const foundMemoriesRef = useRef(false);
  const hasFetchedOnceRef = useRef(false);

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchBySession = useCallback(() => {
    if (!sessionId) return;

    const isFirstFetch = !hasFetchedOnceRef.current;
    if (isFirstFetch) {
      setIsLoading(true);
    }

    searchLongTermMemoryBySession(sessionId)
      .then((result) => {
        hasFetchedOnceRef.current = true;
        setMemories(result.memories);
        setTotal(result.total);
        setIsLoading(false);
        setError(null);

        const hasMemories = result.total > 0;
        if (hasMemories && !foundMemoriesRef.current) {
          foundMemoriesRef.current = true;
          clearPoll();
        }
      })
      .catch((err: Error) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, [sessionId, clearPoll]);

  useEffect(() => {
    clearPoll();
    foundMemoriesRef.current = false;
    hasFetchedOnceRef.current = false;

    if (!sessionId) {
      setMemories([]);
      setTotal(0);
      setError(null);
      return;
    }

    fetchBySession();
    pollRef.current = setInterval(fetchBySession, EXTRACTION_POLL_INTERVAL_MS);

    return () => clearPoll();
  }, [sessionId, fetchBySession, clearPoll]);

  const searchByText = useCallback((query: string) => {
    setIsLoading(true);
    searchLongTermMemory({ text: query })
      .then((result) => {
        setMemories(result.memories);
        setTotal(result.total);
        setIsLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, []);

  return {
    memories,
    total,
    isLoading,
    error,
    refetch: fetchBySession,
    searchByText,
  };
};

export { useLongTermMemory };
export type { UseLongTermMemoryResult };
