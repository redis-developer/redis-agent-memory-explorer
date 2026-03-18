"use client";

import type { TranscriptChunk } from "@/types/transcript.types";
import type { AppendResult } from "@/types/memory.types";

import { useState, useRef, useCallback } from "react";

import { appendChunk } from "@/services/api.service";
import { PLAYBACK_STATUS } from "@/constants/app.constants";

type PlaybackStatusValue = (typeof PLAYBACK_STATUS)[keyof typeof PLAYBACK_STATUS];

type UseTranscriptPlaybackResult = {
  displayedChunks: TranscriptChunk[];
  currentIndex: number;
  totalChunks: number;
  isPlaying: boolean;
  isComplete: boolean;
  status: PlaybackStatusValue;
  lastAppendResult: AppendResult | null;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
  loadAll: () => void;
};

const useTranscriptPlayback = (
  chunks: TranscriptChunk[],
  sessionId: string | null,
  intervalMs: number,
): UseTranscriptPlaybackResult => {
  const [displayedChunks, setDisplayedChunks] = useState<TranscriptChunk[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState<PlaybackStatusValue>(PLAYBACK_STATUS.IDLE);
  const [lastAppendResult, setLastAppendResult] = useState<AppendResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const indexRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    const hasNoSession = !sessionId;
    const hasNoChunks = chunks.length === 0;
    if (hasNoSession || hasNoChunks) return;

    setStatus(PLAYBACK_STATUS.PLAYING);
    setError(null);
    indexRef.current = currentIndex;

    intervalRef.current = setInterval(() => {
      const idx = indexRef.current;
      const isFinished = idx >= chunks.length;
      if (isFinished) {
        clearTimer();
        setStatus(PLAYBACK_STATUS.COMPLETED);
        return;
      }

      const chunk = chunks[idx];
      const isLastChunk = idx === chunks.length - 1;

      setDisplayedChunks((prev) => [...prev, chunk]);
      setCurrentIndex(idx + 1);
      indexRef.current = idx + 1;

      appendChunk(sessionId, chunk, isLastChunk)
        .then((result) => {
          setLastAppendResult(result);
        })
        .catch((err: Error) => {
          console.error("Append chunk failed:", err.message);
        });

      if (isLastChunk) {
        clearTimer();
        setStatus(PLAYBACK_STATUS.COMPLETED);
      }
    }, intervalMs);
  }, [sessionId, chunks, intervalMs, currentIndex, clearTimer]);

  const stop = useCallback(() => {
    clearTimer();
    setStatus(PLAYBACK_STATUS.IDLE);
  }, [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    setDisplayedChunks([]);
    setCurrentIndex(0);
    indexRef.current = 0;
    setStatus(PLAYBACK_STATUS.IDLE);
    setLastAppendResult(null);
    setError(null);
  }, [clearTimer]);

  const loadAll = useCallback(() => {
    const hasNoChunks = chunks.length === 0;
    if (hasNoChunks) return;

    clearTimer();
    setDisplayedChunks([...chunks]);
    const total = chunks.length;
    setCurrentIndex(total);
    indexRef.current = total;
    setStatus(PLAYBACK_STATUS.COMPLETED);
    setError(null);
  }, [chunks, clearTimer]);

  return {
    displayedChunks,
    currentIndex,
    totalChunks: chunks.length,
    isPlaying: status === PLAYBACK_STATUS.PLAYING,
    isComplete: status === PLAYBACK_STATUS.COMPLETED,
    status,
    lastAppendResult,
    error,
    start,
    stop,
    reset,
    loadAll,
  };
};

export { useTranscriptPlayback };
export type { UseTranscriptPlaybackResult, PlaybackStatusValue };
