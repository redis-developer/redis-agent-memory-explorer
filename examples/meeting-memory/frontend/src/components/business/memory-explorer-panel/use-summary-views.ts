"use client";

import type { SummaryViewData, ComputedSummaryData } from "@/types/memory.types";

import { useState, useCallback, useEffect } from "react";

import {
  listSummaryViews,
  computeSummary,
  fetchComputedSummaries,
  createSummaryView,
  deleteSummaryView,
} from "@/services/api.service";

type UseSummaryViewsResult = {
  views: SummaryViewData[];
  summaries: Map<string, ComputedSummaryData[]>;
  isLoading: boolean;
  isComputingSummary: boolean;
  error: string | null;
  computeCount: number;
  computeDefaultSummary: (group: Record<string, string>) => Promise<void>;
  fetchSummariesForView: (viewId: string) => Promise<void>;
  createNewView: (input: {
    name?: string;
    source: string;
    groupBy?: string[];
    timeWindowDays?: number;
  }) => Promise<void>;
  computeSummaryForView: (
    viewId: string,
    group: Record<string, string>,
  ) => Promise<void>;
  deleteView: (viewId: string) => Promise<void>;
  refreshViews: () => void;
  resetAndRefresh: () => void;
};

const useSummaryViews = (
  defaultSummaryViewId: string | null,
): UseSummaryViewsResult => {
  const [views, setViews] = useState<SummaryViewData[]>([]);
  const [summaries, setSummaries] = useState<Map<string, ComputedSummaryData[]>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isComputingSummary, setIsComputingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [computeCount, setComputeCount] = useState(0);

  const loadViews = useCallback(() => {
    setIsLoading(true);
    listSummaryViews()
      .then((res) => {
        setViews(res.views);
        setIsLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    loadViews();
  }, [loadViews]);

  const doComputeSummary = useCallback(
    async (viewId: string, group: Record<string, string>) => {
      setIsComputingSummary(true);
      setError(null);

      try {
        const result = await computeSummary(viewId, group);

        const summaryData: ComputedSummaryData = {
          group: result.group,
          summary: result.summary,
          memoryCount: result.memoryCount,
          computedAt: result.computedAt,
        };

        setSummaries((prev) => {
          const next = new Map(prev);
          const existing = next.get(viewId) ?? [];
          const updatedIdx = existing.findIndex(
            (s) => JSON.stringify(s.group) === JSON.stringify(summaryData.group),
          );
          const hasExisting = updatedIdx >= 0;
          if (hasExisting) {
            const updated = [...existing];
            updated[updatedIdx] = summaryData;
            next.set(viewId, updated);
          } else {
            next.set(viewId, [...existing, summaryData]);
          }
          return next;
        });
        setComputeCount((prev) => prev + 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsComputingSummary(false);
      }
    },
    [],
  );

  const computeDefaultSummary = useCallback(
    async (group: Record<string, string>) => {
      if (!defaultSummaryViewId) return;
      await doComputeSummary(defaultSummaryViewId, group);
    },
    [defaultSummaryViewId, doComputeSummary],
  );

  const fetchSummariesForView = useCallback(async (viewId: string) => {
    setIsLoading(true);
    try {
      const res = await fetchComputedSummaries(viewId);
      setSummaries((prev) => {
        const next = new Map(prev);
        next.set(viewId, res.summaries);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createNewView = useCallback(
    async (input: {
      name?: string;
      source: string;
      groupBy?: string[];
      timeWindowDays?: number;
    }) => {
      setIsLoading(true);
      try {
        await createSummaryView(input);
        loadViews();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setIsLoading(false);
      }
    },
    [loadViews],
  );

  const deleteView = useCallback(
    async (viewId: string) => {
      try {
        await deleteSummaryView(viewId);
        loadViews();
        setSummaries((prev) => {
          const next = new Map(prev);
          next.delete(viewId);
          return next;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [loadViews],
  );

  const resetAndRefresh = useCallback(() => {
    setSummaries(new Map());
    setComputeCount(0);
    setError(null);
    loadViews();
  }, [loadViews]);

  return {
    views,
    summaries,
    isLoading,
    isComputingSummary,
    error,
    computeCount,
    computeDefaultSummary,
    fetchSummariesForView,
    createNewView,
    computeSummaryForView: doComputeSummary,
    deleteView,
    refreshViews: loadViews,
    resetAndRefresh,
  };
};

export { useSummaryViews };
export type { UseSummaryViewsResult };
