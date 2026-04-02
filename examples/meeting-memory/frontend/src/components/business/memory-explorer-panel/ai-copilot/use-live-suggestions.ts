"use client";

import type { LiveSuggestion, DetectedTopic } from "@/types/suggestion.types";

import { useState, useEffect, useRef, useCallback } from "react";

import {
  generateSuggestion,
  listSuggestions,
} from "@/services/api.service";

type UseLiveSuggestionsInput = {
  sessionId: string | null;
  currentChunkIndex: number;
  isPlaying: boolean;
  triggerEveryNChunks: number;
};

type UseLiveSuggestionsResult = {
  suggestions: LiveSuggestion[];
  latestSuggestion: LiveSuggestion | null;
  detectedTopics: DetectedTopic[];
  isGenerating: boolean;
  error: string | null;
};

const useLiveSuggestions = ({
  sessionId,
  currentChunkIndex,
  isPlaying,
  triggerEveryNChunks,
}: UseLiveSuggestionsInput): UseLiveSuggestionsResult => {
  const [suggestions, setSuggestions] = useState<LiveSuggestion[]>([]);
  const [detectedTopics, setDetectedTopics] = useState<DetectedTopic[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastTriggeredIndexRef = useRef(-1);
  const prevSessionIdRef = useRef<string | null>(null);
  const isGeneratingRef = useRef(false);

  const resetState = useCallback(() => {
    setSuggestions([]);
    setDetectedTopics([]);
    setIsGenerating(false);
    setError(null);
    lastTriggeredIndexRef.current = -1;
    isGeneratingRef.current = false;
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

    listSuggestions(sessionId)
      .then((result) => {
        setSuggestions(result.suggestions);
        setDetectedTopics(result.detectedTopics);
        const hasExisting = result.suggestions.length > 0;
        if (hasExisting) {
          const lastSuggestion = result.suggestions[result.suggestions.length - 1];
          lastTriggeredIndexRef.current = lastSuggestion.chunkIndex;
        }
      })
      .catch((err: Error) => {
        console.error("Failed to load suggestions:", err.message);
      });
  }, [sessionId, resetState]);

  useEffect(() => {
    const hasNoSession = sessionId === null;
    if (hasNoSession || !isPlaying) {
      return;
    }

    const gap = currentChunkIndex - lastTriggeredIndexRef.current;
    const shouldTrigger = gap >= triggerEveryNChunks && !isGeneratingRef.current;

    if (!shouldTrigger) {
      return;
    }

    lastTriggeredIndexRef.current = currentChunkIndex;
    isGeneratingRef.current = true;
    setIsGenerating(true);
    setError(null);

    generateSuggestion(sessionId, currentChunkIndex)
      .then((result) => {
        const hasSuggestion = result.suggestion !== null;
        if (hasSuggestion) {
          setSuggestions((prev) => [...prev, result.suggestion!]);
        }
        setDetectedTopics(result.detectedTopics);
      })
      .catch((err: Error) => {
        setError(err.message);
        console.error("Suggestion generation failed:", err.message);
      })
      .finally(() => {
        setIsGenerating(false);
        isGeneratingRef.current = false;
      });
  }, [sessionId, currentChunkIndex, isPlaying, triggerEveryNChunks]);

  const latestSuggestion = suggestions.length > 0
    ? suggestions[suggestions.length - 1]
    : null;

  return {
    suggestions,
    latestSuggestion,
    detectedTopics,
    isGenerating,
    error,
  };
};

export { useLiveSuggestions };

export type { UseLiveSuggestionsResult };
