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
  computingViewId: string | null;
  error: string | null;
  computedSummaryCount: number;
  summaryViewCount: number;
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

const useSummaryViews = (): UseSummaryViewsResult => {
  const [views, setViews] = useState<SummaryViewData[]>([]);
  const [summaries, setSummaries] = useState<Map<string, ComputedSummaryData[]>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [computingViewId, setComputingViewId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const computedSummaryCount = Array.from(summaries.values()).reduce(
    (acc, list) => acc + list.length,
    0,
  );
  const summaryViewCount = views.length;

  const loadViews = useCallback(() => {
    setIsLoading(true);
    setError(null);
    listSummaryViews()
      .then((res) => {
        setViews(res.views);
        const fetchPromises = res.views.map((view) =>
          fetchComputedSummaries(view.viewId)
            .then((r) => ({ viewId: view.viewId, summaries: r.summaries }))
            .catch(() => ({ viewId: view.viewId, summaries: [] as ComputedSummaryData[] })),
        );
        return Promise.all(fetchPromises);
      })
      .then((results) => {
        const newSummaries = new Map<string, ComputedSummaryData[]>();
        for (const { viewId, summaries: viewSummaries } of results) {
          const hasSummaries = viewSummaries.length > 0;
          if (hasSummaries) {
            newSummaries.set(viewId, viewSummaries);
          }
        }
        setSummaries(newSummaries);
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
      setComputingViewId(viewId);
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
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setComputingViewId(null);
      }
    },
    [],
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
    setError(null);
    loadViews();
  }, [loadViews]);

  return {
    views,
    summaries,
    isLoading,
    computingViewId,
    error,
    computedSummaryCount,
    summaryViewCount,
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
