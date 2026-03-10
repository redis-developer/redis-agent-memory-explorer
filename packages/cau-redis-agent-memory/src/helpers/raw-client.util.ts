/**
 * Raw HTTP client for Agent Memory Server endpoints where the SDK
 * has gaps (e.g., user_id not supported in GET/DELETE query params).
 *
 * See: https://github.com/redis/agent-memory-server/issues/185
 */

import type { RawClientConfig } from "../types";

import { DEFAULT_TIMEOUT_MS } from "../constants";

const buildHeaders = (config: RawClientConfig): Record<string, string> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const hasApiKey = config.apiKey !== undefined;
  if (hasApiKey) {
    headers["X-API-Key"] = config.apiKey!;
  }

  const hasBearer = config.bearerToken !== undefined;
  if (hasBearer) {
    headers["Authorization"] = `Bearer ${config.bearerToken}`;
  }

  return headers;
};

const buildUrl = (
  baseUrl: string,
  path: string,
  params: Record<string, string | number | undefined>,
): string => {
  const url = new URL(path, baseUrl);

  for (const [key, value] of Object.entries(params)) {
    const hasValue = value !== undefined && value !== null;
    if (hasValue) {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
};

const HTTP_STATUS_NOT_FOUND = 404;

const rawRequest = async (
  config: RawClientConfig,
  method: string,
  path: string,
  params: Record<string, string | number | undefined>,
): Promise<Response> => {
  const url = buildUrl(config.baseUrl, path, params);
  const headers = buildHeaders(config);
  const timeout = config.timeout ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method,
      headers,
      signal: controller.signal,
    });

    const isError = !response.ok;
    if (isError) {
      const body = await response.text();
      throw new Error(
        `Agent Memory Server ${method} ${path} failed (${response.status}): ${body}`,
      );
    }

    return response;
  } finally {
    clearTimeout(timer);
  }
};

const rawGet = async <T>(
  config: RawClientConfig,
  path: string,
  params: Record<string, string | number | undefined>,
): Promise<T> => {
  const response = await rawRequest(config, "GET", path, params);
  const result = (await response.json()) as T;

  return result;
};

const rawDelete = async (
  config: RawClientConfig,
  path: string,
  params: Record<string, string | number | undefined>,
): Promise<{ status: string }> => {
  const response = await rawRequest(config, "DELETE", path, params);

  const result = (await response.json()) as { status: string };

  return result;
};

export { rawGet, rawDelete };
