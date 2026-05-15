import type { LoadRecordsInput, LoadRecordsResult } from "../../types";

import { DEFAULT_TIMEOUT_MS, DATA_LOAD_ENDPOINT_TEMPLATE } from "../../constants";
import { fetchAdminApi } from "../../http";

type DataLoaderConfig = {
  adminApiUrl: string;
  adminKey: string;
  timeout?: number;
};

const loadRecords = async (
  config: DataLoaderConfig,
  surfaceId: string,
  input: LoadRecordsInput,
): Promise<LoadRecordsResult> => {
  const path = DATA_LOAD_ENDPOINT_TEMPLATE.replace("{surfaceId}", surfaceId);
  const timeoutMs = config.timeout ?? DEFAULT_TIMEOUT_MS;

  const body: Record<string, unknown> = {
    entity: input.entity,
    records: input.records,
  };

  const hasOptions = input.options !== undefined;
  if (hasOptions) {
    body.options = {
      on_conflict: input.options!.onConflict,
      on_error: input.options!.onError,
    };
  }

  const responseBody = await fetchAdminApi({
    adminApiUrl: config.adminApiUrl,
    adminKey: config.adminKey,
    timeout: timeoutMs,
    path,
    method: "POST",
    body,
  });

  return {
    loaded: (responseBody.imported as number) ?? (responseBody.loaded as number) ?? 0,
    errors: responseBody.errors as LoadRecordsResult["errors"],
  };
};

export { loadRecords };

export type { DataLoaderConfig };
