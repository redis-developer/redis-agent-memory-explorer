"use client";

import type {
  DatasetConfig,
  UseDatasetConfigResult,
} from "@/types/dataset-config.types";

import { useState, useEffect } from "react";

import { fetchDatasetConfig } from "@/services/api.service";

const useDatasetConfig = (): UseDatasetConfigResult => {
  const [config, setConfig] = useState<DatasetConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = () => {
    setIsLoading(true);
    setError(null);
    fetchDatasetConfig()
      .then((data) => {
        setConfig(data);
        setIsLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    loadConfig();
  }, []);

  return { config, isLoading, error, retry: loadConfig };
};

export { useDatasetConfig };
export type { UseDatasetConfigResult };
