"use client";

import type { WorkingMemoryData } from "@/types/memory.types";

import { useState, useEffect, useCallback, useRef } from "react";

import { fetchWorkingMemory } from "@/services/api.service";
import { WORKING_MEMORY_POLL_INTERVAL_MS } from "@/constants/app.constants";

type UseWorkingMemoryResult = {
  data: WorkingMemoryData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};

const useWorkingMemory = (
  sessionId: string | null,
  enabled: boolean,
): UseWorkingMemoryResult => {
  const [data, setData] = useState<WorkingMemoryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasFetchedOnceRef = useRef(false);

  const doFetch = useCallback(() => {
    if (!sessionId) return;

    const isFirstFetch = !hasFetchedOnceRef.current;
    if (isFirstFetch) {
      setIsLoading(true);
    }

    fetchWorkingMemory(sessionId)
      .then((result) => {
        hasFetchedOnceRef.current = true;
        setData(result);
        setIsLoading(false);
        setError(null);
      })
      .catch((err: Error) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, [sessionId]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const shouldNotPoll = !sessionId || !enabled;
    if (shouldNotPoll) return;

    doFetch();
    intervalRef.current = setInterval(doFetch, WORKING_MEMORY_POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [sessionId, enabled, doFetch]);

  useEffect(() => {
    if (!sessionId) {
      setData(null);
      setError(null);
      hasFetchedOnceRef.current = false;
    }
  }, [sessionId]);

  return { data, isLoading, error, refetch: doFetch };
};

export { useWorkingMemory };
export type { UseWorkingMemoryResult };
