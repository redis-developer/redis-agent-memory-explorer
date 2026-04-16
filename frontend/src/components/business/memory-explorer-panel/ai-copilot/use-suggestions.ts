"use client";

import type { Suggestion, DetectedTopic } from "@/types/suggestion.types";

import { useState, useEffect, useRef, useCallback } from "react";

import { generateSuggestion, listSuggestions } from "@/services/api.service";

type UseSuggestionsInput = {
  sessionId: string | null;
  currentChunkIndex: number;
  isPlaybackComplete: boolean;
  triggerEveryNChunks: number;
};

type UseSuggestionsResult = {
  suggestions: Suggestion[];
  latestSuggestion: Suggestion | null;
  detectedTopics: DetectedTopic[];
  isGenerating: boolean;
  error: string | null;
};

/**
 * Triggers live AI suggestions at every N-chunk boundary during playback.
 *
 * Only one generation runs at a time (isGeneratingRef guard). If boundaries are
 * crossed while generation is in progress, those chunk indices are queued in
 * pendingTriggersRef (only actual N-boundary crossings, not every chunk). When
 * the current generation completes, the next queued trigger fires immediately,
 * chaining until the queue is drained. No boundary is permanently skipped.
 */
const useSuggestions = ({
  sessionId,
  currentChunkIndex,
  isPlaybackComplete,
  triggerEveryNChunks,
}: UseSuggestionsInput): UseSuggestionsResult => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [detectedTopics, setDetectedTopics] = useState<DetectedTopic[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastTriggeredIndexRef = useRef(-1);
  const prevSessionIdRef = useRef<string | null>(null);
  const isGeneratingRef = useRef(false);
  const pendingTriggersRef = useRef<number[]>([]);
  // Ref for stable access in .finally() without stale closure
  const sessionIdRef = useRef(sessionId);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Extracted so the .finally() callback can chain queued triggers without
  // relying on the effect re-running
  const startGeneration = useCallback(
    (targetSessionId: string, chunkIndex: number) => {
      const prevTriggeredIndex = lastTriggeredIndexRef.current;
      lastTriggeredIndexRef.current = chunkIndex;
      isGeneratingRef.current = true;
      setIsGenerating(true);
      setError(null);

      let failed = false;

      generateSuggestion(targetSessionId, chunkIndex)
        .then((result) => {
          const isStale = sessionIdRef.current !== targetSessionId;
          if (!result || isStale) return;
          const hasSuggestion = result.suggestion !== null;
          if (hasSuggestion) {
            setSuggestions((prev) => [...prev, result.suggestion!]);
          }
          setDetectedTopics(result.detectedTopics);
        })
        .catch((err: Error) => {
          failed = true;
          lastTriggeredIndexRef.current = prevTriggeredIndex;
          setError(err.message);
          console.error("Suggestion generation failed:", err.message);
        })
        .finally(() => {
          isGeneratingRef.current = false;
          setIsGenerating(false);

          // On error: keep the queue intact, don't drain.
          // failures if the API is down.
          if (failed) return;

          // Fire the next queued boundary.
          const currentSessionId = sessionIdRef.current;
          const nextIndex = pendingTriggersRef.current.shift();
          if (nextIndex !== undefined && currentSessionId) {
            startGeneration(currentSessionId, nextIndex);
          }
        });
    },
    [],
  );

  const resetState = useCallback(() => {
    setSuggestions([]);
    setDetectedTopics([]);
    setIsGenerating(false);
    setError(null);
    lastTriggeredIndexRef.current = -1;
    isGeneratingRef.current = false;
    pendingTriggersRef.current = [];
  }, []);

  useEffect(() => {
    const sessionChanged = prevSessionIdRef.current !== sessionId;
    prevSessionIdRef.current = sessionId;

    if (!sessionChanged) {
      return;
    }

    resetState();

    const hasNoSession = sessionId === null;
    if (hasNoSession) {
      return;
    }

    const requestedSessionId = sessionId;
    listSuggestions(sessionId)
      .then((result) => {
        const isStale = sessionIdRef.current !== requestedSessionId;
        if (isStale) return;
        setSuggestions(result.suggestions);
        setDetectedTopics(result.detectedTopics);
        const hasExisting = result.suggestions.length > 0;
        if (hasExisting) {
          const lastSuggestion =
            result.suggestions[result.suggestions.length - 1];
          lastTriggeredIndexRef.current = lastSuggestion.chunkIndex;
        }
      })
      .catch((err: Error) => {
        console.error("Failed to load suggestions:", err.message);
      });
  }, [sessionId, resetState]);

  useEffect(() => {
    const hasNoSession = sessionId === null;
    if (hasNoSession || isPlaybackComplete) {
      return;
    }

    const gap = currentChunkIndex - lastTriggeredIndexRef.current;
    const shouldTrigger = gap >= triggerEveryNChunks;

    if (!shouldTrigger) {
      return;
    }

    // Queue the boundary instead of dropping it when a generation is in flight.
    // Only push if this is a new N-boundary beyond the last queued index, so we
    // don't flood the queue with every single chunk after the first boundary.
    if (isGeneratingRef.current) {
      const queue = pendingTriggersRef.current;
      const lastQueued =
        queue.length > 0
          ? queue[queue.length - 1]
          : lastTriggeredIndexRef.current;
      const queueGap = currentChunkIndex - lastQueued;
      if (queueGap >= triggerEveryNChunks) {
        queue.push(currentChunkIndex);
      }
      return;
    }

    startGeneration(sessionId, currentChunkIndex);
  }, [
    sessionId,
    currentChunkIndex,
    isPlaybackComplete,
    triggerEveryNChunks,
    startGeneration,
  ]);

  const latestSuggestion =
    suggestions.length > 0 ? suggestions[suggestions.length - 1] : null;

  return {
    suggestions,
    latestSuggestion,
    detectedTopics,
    isGenerating,
    error,
  };
};

export { useSuggestions as useSuggestions };

export type { UseSuggestionsResult as UseSuggestionsResult };
