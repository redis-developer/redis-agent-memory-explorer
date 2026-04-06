import type { DatasetConfig, DatasetSummary } from "../types";

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Logger } from "cau-logger";

import { CONFIG_FILENAME } from "../constants";
import { ENV } from "../config";

let _logger: ReturnType<typeof Logger.getInstance> | null = null;
const getLogger = () => {
  if (!_logger)
    _logger = Logger.getInstance().child({ component: "DatasetLoader" });
  return _logger;
};

const loadDatasetConfig = (datasetId: string): DatasetConfig => {
  const logger = getLogger();

  const configPath = join(ENV.DATA_DIR, datasetId, CONFIG_FILENAME);
  const fileExists = existsSync(configPath);

  if (!fileExists) {
    throw new Error(`Dataset config not found: ${configPath}`);
  }

  const raw = readFileSync(configPath, "utf-8");
  const parsed = JSON.parse(raw) as DatasetConfig;

  logger.info("Dataset config loaded", {
    datasetId,
    namespace: parsed.namespace,
  });

  return parsed;
};

const listDatasets = (): DatasetSummary[] => {
  const logger = getLogger();

  const dirExists = existsSync(ENV.DATA_DIR);
  const datasets: DatasetSummary[] = [];

  if (dirExists) {
    const entries = readdirSync(ENV.DATA_DIR, { withFileTypes: true });

    for (const entry of entries) {
      const isDirectory = entry.isDirectory();
      const hasConfig =
        isDirectory &&
        existsSync(join(ENV.DATA_DIR, entry.name, CONFIG_FILENAME));

      if (hasConfig) {
        const config = loadDatasetConfig(entry.name);
        datasets.push({ id: config.id, name: config.name });
      }
    }
  }

  logger.info("Datasets listed", {
    count: datasets.length,
    dataDir: ENV.DATA_DIR,
  });

  return datasets;
};

const DatasetLoaderService = {
  loadDatasetConfig,
  listDatasets,
};

export { DatasetLoaderService };
