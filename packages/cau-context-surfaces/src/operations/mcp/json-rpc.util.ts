import type { JsonRpcRequest, JsonRpcError } from "../../types";

import { JSONRPC_VERSION } from "../../constants";

let requestIdCounter = 0;

const buildJsonRpcRequest = (
  method: string,
  params?: Record<string, unknown>,
  id?: number,
): JsonRpcRequest => {
  requestIdCounter += 1;
  const requestId = id ?? requestIdCounter;

  return {
    jsonrpc: JSONRPC_VERSION,
    id: requestId,
    method,
    params: params ?? {},
  };
};

const parseJsonRpcResponse = (body: unknown): { result: unknown } => {
  const isNullish = body === null || body === undefined;
  if (isNullish) {
    throw new Error("JSON-RPC response body is null or undefined");
  }

  const response = body as Record<string, unknown>;

  const hasError = "error" in response && response.error !== null;
  if (hasError) {
    const error = response.error as JsonRpcError;
    throw new Error(
      `JSON-RPC error (code ${error.code}): ${error.message}`,
    );
  }

  const hasResult = "result" in response;
  if (!hasResult) {
    throw new Error("JSON-RPC response has no result and no error");
  }

  return { result: response.result };
};

const resetRequestIdCounter = (): void => {
  requestIdCounter = 0;
};

export { buildJsonRpcRequest, parseJsonRpcResponse, resetRequestIdCounter };
