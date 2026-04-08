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
  EXTRACTION_MAX_WAIT_MS,
  STABILIZATION_POLL_COUNT,
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

/**
 * Polls for long-term memories extracted by the Agent Memory Server (AMS).
 *
 * Polling strategy (why it matters):
 * AMS can extract LT memories at two points -- (1) explicitly when the app
 * sends `isLastChunk: true`, and (2) autonomously mid-playback when AMS
 * compresses the working memory context window or auto extract memories after some interval gap. Because of (2), memories can
 * appear at any time during playback, not just after completion.
 *
 * To avoid missing extraction rounds:
 * - During playback: poll continuously, never stop on first detection.
 * - After playback completes: continue polling for a grace period
 *   (EXTRACTION_MAX_WAIT_MS) to catch the final explicit extraction.
 * - Stop early if the count stabilizes (same total for STABILIZATION_POLL_COUNT
 *   consecutive polls), meaning all extractions have settled.
 */
const useLongTermMemory = (
  sessionId: string | null,
  isPlaybackComplete: boolean,
): UseLongTermMemoryResult => {
  const [memories, setMemories] = useState<MemoryRecordData[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [allTotal, setAllTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScopeState] = useState<LtScope>(LT_SCOPE.SESSION);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFetchedOnceRef = useRef(false);
  const isPlaybackCompleteRef = useRef(isPlaybackComplete);
  const lastTotalRef = useRef(-1);
  const stableCountRef = useRef(0);

  const total = scope === LT_SCOPE.SESSION ? sessionTotal : allTotal;

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const clearGraceTimer = useCallback(() => {
    if (graceTimerRef.current) {
      clearTimeout(graceTimerRef.current);
      graceTimerRef.current = null;
    }
  }, []);

  // Reset stabilization tracking when playback completes so the post-completion
  // grace window starts fresh. Without this, mid-playback stability (e.g., total
  // unchanged for many polls while AMS hasn't extracted again) would cause an
  // immediate stop before the final explicit extraction has time to finish.
  useEffect(() => {
    const wasComplete = isPlaybackCompleteRef.current;
    isPlaybackCompleteRef.current = isPlaybackComplete;

    const justCompleted = isPlaybackComplete && !wasComplete;
    if (justCompleted) {
      stableCountRef.current = 0;
      lastTotalRef.current = -1;
    }
  }, [isPlaybackComplete]);

  const refreshAllTotal = useCallback(() => {
    searchLongTermMemory({ limit: SEARCH_ALL_LIMIT })
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

        // Track how many consecutive polls return the same total.
        // Only stop polling after playback is done AND count has settled,
        // so we don't miss late extraction rounds from AMS.
        const isSameTotal = result.total === lastTotalRef.current;
        if (isSameTotal) {
          stableCountRef.current += 1;
        } else {
          stableCountRef.current = 0;
        }
        lastTotalRef.current = result.total;

        const isStabilized =
          isPlaybackCompleteRef.current &&
          result.total > 0 &&
          stableCountRef.current >= STABILIZATION_POLL_COUNT;
        if (isStabilized) {
          clearPoll();
          clearGraceTimer();
        }

        refreshAllTotal();
      })
      .catch((err: Error) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, [sessionId, clearPoll, clearGraceTimer, refreshAllTotal]);

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
        lastTotalRef.current = -1;
        stableCountRef.current = 0;
        fetchBySession();
        pollRef.current = setInterval(
          fetchBySession,
          EXTRACTION_POLL_INTERVAL_MS,
        );
      } else {
        fetchAll();
      }
    },
    [sessionId, fetchBySession, fetchAll, clearPoll],
  );

  useEffect(() => {
    clearPoll();
    clearGraceTimer();
    hasFetchedOnceRef.current = false;
    lastTotalRef.current = -1;
    stableCountRef.current = 0;
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

    return () => {
      clearPoll();
      clearGraceTimer();
    };
  }, [sessionId, fetchBySession, clearPoll, clearGraceTimer]);

  // Hard-stop safety net: after playback completes, stop polling after
  // EXTRACTION_MAX_WAIT_MS even if the count never stabilizes (e.g., AMS
  // keeps producing memories in small batches). The stabilization check
  // inside fetchBySession usually fires first for normal flows.
  useEffect(() => {
    if (!isPlaybackComplete || !sessionId) {
      return;
    }

    graceTimerRef.current = setTimeout(() => {
      clearPoll();
    }, EXTRACTION_MAX_WAIT_MS);

    return () => clearGraceTimer();
  }, [isPlaybackComplete, sessionId, clearPoll, clearGraceTimer]);

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
