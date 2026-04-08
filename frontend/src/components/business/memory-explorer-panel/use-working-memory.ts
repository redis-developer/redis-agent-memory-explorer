"use client";

import type { WorkingMemoryData } from "@/types/memory.types";

import { useState, useEffect, useCallback, useRef } from "react";

import { fetchWorkingMemory } from "@/services/api.service";
import {
  WORKING_MEMORY_POLL_INTERVAL_MS,
  WM_POST_COMPLETION_GRACE_MS,
} from "@/constants/app.constants";

type UseWorkingMemoryResult = {
  data: WorkingMemoryData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};

/**
 * Polls for the current working memory state during and shortly after playback.
 *
 * Polling lifecycle:
 * - While `enabled` and session exists: polls every WORKING_MEMORY_POLL_INTERVAL_MS (3s).
 * - When `isPlaybackComplete` transitions to true: polling continues for a grace
 *   period of WM_POST_COMPLETION_GRACE_MS (15s). AMS may still be processing
 *   the final chunk (context summarization, token recalculation, etc.) so we
 *   keep fetching to pick up those updates.
 * - After the grace period expires: polling stops.
 * - After polling stops, the Refresh button (refetch) remains available.
 */
const useWorkingMemory = (
  sessionId: string | null,
  enabled: boolean,
  isPlaybackComplete: boolean,
): UseWorkingMemoryResult => {
  const [data, setData] = useState<WorkingMemoryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFetchedOnceRef = useRef(false);

  const clearPoll = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const clearGraceTimer = useCallback(() => {
    if (graceTimerRef.current) {
      clearTimeout(graceTimerRef.current);
      graceTimerRef.current = null;
    }
  }, []);

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
    clearPoll();
    clearGraceTimer();
    hasFetchedOnceRef.current = false;

    const shouldNotPoll = !sessionId || !enabled;
    if (shouldNotPoll) return;

    doFetch();
    intervalRef.current = setInterval(doFetch, WORKING_MEMORY_POLL_INTERVAL_MS);

    return () => {
      clearPoll();
      clearGraceTimer();
    };
  }, [sessionId, enabled, doFetch, clearPoll, clearGraceTimer]);

  // After playback completes, let polling continue for a grace period so AMS
  // can finish processing the last chunk, then stop.
  useEffect(() => {
    if (!isPlaybackComplete || !sessionId) {
      return;
    }

    graceTimerRef.current = setTimeout(() => {
      clearPoll();
    }, WM_POST_COMPLETION_GRACE_MS);

    return () => clearGraceTimer();
  }, [isPlaybackComplete, sessionId, clearPoll, clearGraceTimer]);

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
