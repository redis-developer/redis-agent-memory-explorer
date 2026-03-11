import type { DatasetConfig, DatasetSummary } from "../types";

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

import { DATA_DIR } from "../config";

const CONFIG_FILENAME = "dataset.config.json";

const loadDatasetConfig = (datasetId: string): DatasetConfig => {
  const configPath = join(DATA_DIR, datasetId, CONFIG_FILENAME);
  const fileExists = existsSync(configPath);

  if (!fileExists) {
    throw new Error(
      `Dataset config not found: ${configPath}`,
    );
  }

  const raw = readFileSync(configPath, "utf-8");
  const parsed = JSON.parse(raw) as DatasetConfig;

  return parsed;
};

const listDatasets = (): DatasetSummary[] => {
  const dirExists = existsSync(DATA_DIR);

  if (!dirExists) {
    return [];
  }

  const entries = readdirSync(DATA_DIR, { withFileTypes: true });
  const datasets: DatasetSummary[] = [];

  for (const entry of entries) {
    const isDirectory = entry.isDirectory();
    const hasConfig = isDirectory && existsSync(
      join(DATA_DIR, entry.name, CONFIG_FILENAME),
    );

    if (hasConfig) {
      const config = loadDatasetConfig(entry.name);
      datasets.push({ id: config.id, name: config.name });
    }
  }

  return datasets;
};

const DatasetLoaderService = {
  loadDatasetConfig,
  listDatasets,
};

export { DatasetLoaderService };
