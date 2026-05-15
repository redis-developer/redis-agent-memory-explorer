import { buildJsonRpcRequest, parseJsonRpcResponse } from "./operations/mcp/json-rpc.util";

interface AdminApiRequestOptions {
  adminApiUrl: string;
  adminKey: string;
  timeout: number;
  path: string;
  method: string;
  body?: Record<string, unknown>;
}

interface McpRpcRequestOptions {
  mcpUrl: string;
  agentKey: string;
  timeout: number;
  method: string;
  params?: Record<string, unknown>;
}

const fetchWithTimeout = async (
  url: string,
  apiKey: string,
  timeout: number,
  body: unknown,
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  return response;
};

const fetchAdminApi = async (options: AdminApiRequestOptions): Promise<Record<string, unknown>> => {
  const normalizedBase = options.adminApiUrl.endsWith("/")
    ? options.adminApiUrl.slice(0, -1)
    : options.adminApiUrl;
  const url = `${normalizedBase}${options.path}`;

  const response = await fetchWithTimeout(url, options.adminKey, options.timeout, options.body);

  const isNotOk = !response.ok;
  if (isNotOk) {
    const text = await response.text();
    throw new Error(`${options.method} ${options.path} failed (${response.status}): ${text}`);
  }

  const responseBody = (await response.json()) as Record<string, unknown>;

  return responseBody;
};

const fetchMcpRpc = async (options: McpRpcRequestOptions): Promise<unknown> => {
  const body = buildJsonRpcRequest(options.method, options.params);

  const response = await fetchWithTimeout(options.mcpUrl, options.agentKey, options.timeout, body);

  const isNotOk = !response.ok;
  if (isNotOk) {
    const text = await response.text();
    throw new Error(`MCP ${options.method} failed (${response.status}): ${text}`);
  }

  const responseBody = await response.json();
  const parsed = parseJsonRpcResponse(responseBody);

  return parsed.result;
};

export { fetchAdminApi, fetchMcpRpc };

export type { AdminApiRequestOptions, McpRpcRequestOptions };
