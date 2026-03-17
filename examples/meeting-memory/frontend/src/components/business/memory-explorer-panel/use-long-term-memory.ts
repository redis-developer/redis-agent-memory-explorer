"use client";

import type { MemoryRecordData } from "@/types/memory.types";
import type { LtScope } from "@/constants/app.constants";

import { useState, useEffect, useCallback, useRef } from "react";

import {
  searchLongTermMemoryBySession,
  searchLongTermMemory,
} from "@/services/api.service";
import {
  EXTRACTION_POLL_INTERVAL_MS,
  LT_SCOPE,
  SEARCH_ALL_LIMIT,
} from "@/constants/app.constants";

type UseLongTermMemoryResult = {
  memories: MemoryRecordData[];
  total: number;
  sessionTotal: number;
  allTotal: number;
  isLoading: boolean;
  error: string | null;
  scope: LtScope;
  setScope: (scope: LtScope) => void;
  refetch: () => void;
  searchByText: (query: string) => void;
};

const useLongTermMemory = (
  sessionId: string | null,
): UseLongTermMemoryResult => {
  const [memories, setMemories] = useState<MemoryRecordData[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [allTotal, setAllTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScopeState] = useState<LtScope>(LT_SCOPE.SESSION);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const foundMemoriesRef = useRef(false);
  const hasFetchedOnceRef = useRef(false);

  const total = scope === LT_SCOPE.SESSION ? sessionTotal : allTotal;

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refreshAllTotal = useCallback(() => {
    searchLongTermMemory({ limit: 1 })
      .then((result) => {
        setAllTotal(result.total);
      })
      .catch(() => {});
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
        setSessionTotal(result.total);
        setIsLoading(false);
        setError(null);

        const hasMemories = result.total > 0;
        if (hasMemories && !foundMemoriesRef.current) {
          foundMemoriesRef.current = true;
          clearPoll();
        }

        refreshAllTotal();
      })
      .catch((err: Error) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, [sessionId, clearPoll, refreshAllTotal]);

  const fetchAll = useCallback(() => {
    setIsLoading(true);
    searchLongTermMemory({ limit: SEARCH_ALL_LIMIT })
      .then((result) => {
        setMemories(result.memories);
        setAllTotal(result.total);
        setIsLoading(false);
        setError(null);
      })
      .catch((err: Error) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, []);

  const refetch = useCallback(() => {
    const isSessionScope = scope === LT_SCOPE.SESSION;
    if (isSessionScope) {
      fetchBySession();
    } else {
      fetchAll();
    }
  }, [scope, fetchBySession, fetchAll]);

  const setScope = useCallback(
    (newScope: LtScope) => {
      setScopeState(newScope);
      clearPoll();

      const isSessionScope = newScope === LT_SCOPE.SESSION;
      if (isSessionScope) {
        if (!sessionId) {
          setMemories([]);
          return;
        }
        hasFetchedOnceRef.current = false;
        foundMemoriesRef.current = false;
        fetchBySession();
        pollRef.current = setInterval(fetchBySession, EXTRACTION_POLL_INTERVAL_MS);
      } else {
        fetchAll();
      }
    },
    [sessionId, fetchBySession, fetchAll, clearPoll],
  );

  useEffect(() => {
    clearPoll();
    foundMemoriesRef.current = false;
    hasFetchedOnceRef.current = false;
    setScopeState(LT_SCOPE.SESSION);

    if (!sessionId) {
      setMemories([]);
      setSessionTotal(0);
      setAllTotal(0);
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
    sessionTotal,
    allTotal,
    isLoading,
    error,
    scope,
    setScope,
    refetch,
    searchByText,
  };
};

export { useLongTermMemory };
export type { UseLongTermMemoryResult };
