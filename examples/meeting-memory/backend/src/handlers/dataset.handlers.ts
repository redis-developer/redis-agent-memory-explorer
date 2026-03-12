import type { RouteHandler } from "cau-api-server";
import type { DatasetResponse } from "../types";

import { getAppState } from "../app-state";
import { ENV } from "../config";
import { DatasetLoaderService } from "../services/dataset-loader.service";

const getDatasetHandler: RouteHandler = async (_input, { logger }) => {
  const { datasetConfig, defaultSummaryViewId } = getAppState();

  logger.info("Serving dataset config", { dataset: datasetConfig?.id });

  const response: DatasetResponse = {
    ...datasetConfig!,
    defaultSummaryViewId,
  };

  return response;
};

const listDatasetsHandler: RouteHandler = async (_input, { logger }) => {
  const datasets = DatasetLoaderService.listDatasets();

  logger.info("Listing datasets", { count: datasets.length });

  return { datasets, active: ENV.ACTIVE_DATASET };
};

export { getDatasetHandler, listDatasetsHandler };
