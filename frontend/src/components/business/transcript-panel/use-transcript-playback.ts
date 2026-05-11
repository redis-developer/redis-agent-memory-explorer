"use client";

import type { TranscriptChunk } from "@/types/transcript.types";

import { useState, useRef, useCallback } from "react";

import { appendChunk } from "@/services/api.service";
import { PLAYBACK_STATUS } from "@/constants/app.constants";

type PlaybackStatusValue =
  (typeof PLAYBACK_STATUS)[keyof typeof PLAYBACK_STATUS];

type UseTranscriptPlaybackResult = {
  displayedChunks: TranscriptChunk[];
  currentIndex: number;
  totalChunks: number;
  isPlaying: boolean;
  isPaused: boolean;
  isComplete: boolean;
  status: PlaybackStatusValue;
  start: () => void;
  pause: () => void;
  next: () => void;
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
  const [status, setStatus] = useState<PlaybackStatusValue>(
    PLAYBACK_STATUS.IDLE,
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const indexRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const advanceOne = useCallback(() => {
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

    appendChunk(sessionId!, chunk, isLastChunk);

    if (isLastChunk) {
      clearTimer();
      setStatus(PLAYBACK_STATUS.COMPLETED);
    }
  }, [chunks, sessionId, clearTimer]);

  const start = useCallback(() => {
    const hasNoSession = !sessionId;
    const hasNoChunks = chunks.length === 0;
    if (hasNoSession || hasNoChunks) return;

    setStatus(PLAYBACK_STATUS.PLAYING);
    indexRef.current = currentIndex;

    intervalRef.current = setInterval(advanceOne, intervalMs);
  }, [sessionId, chunks, intervalMs, currentIndex, advanceOne]);

  const pause = useCallback(() => {
    clearTimer();
    setStatus(PLAYBACK_STATUS.PAUSED);
  }, [clearTimer]);

  const next = useCallback(() => {
    const hasNoSession = !sessionId;
    const hasNoChunks = chunks.length === 0;
    const isFinished = indexRef.current >= chunks.length;
    if (hasNoSession || hasNoChunks || isFinished) return;

    indexRef.current = currentIndex;
    setStatus(PLAYBACK_STATUS.PAUSED);
    advanceOne();
  }, [sessionId, chunks, currentIndex, advanceOne]);

  const reset = useCallback(() => {
    clearTimer();
    setDisplayedChunks([]);
    setCurrentIndex(0);
    indexRef.current = 0;
    setStatus(PLAYBACK_STATUS.IDLE);
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
  }, [chunks, clearTimer]);

  return {
    displayedChunks,
    currentIndex,
    totalChunks: chunks.length,
    isPlaying: status === PLAYBACK_STATUS.PLAYING,
    isPaused: status === PLAYBACK_STATUS.PAUSED,
    isComplete: status === PLAYBACK_STATUS.COMPLETED,
    status,
    start,
    pause,
    next,
    reset,
    loadAll,
  };
};

export { useTranscriptPlayback };
export type { UseTranscriptPlaybackResult, PlaybackStatusValue };
