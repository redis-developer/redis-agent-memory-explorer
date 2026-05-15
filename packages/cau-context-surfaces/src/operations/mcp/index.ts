import type { McpInitResult, McpTool, McpToolResult } from "../../types";

import {
  McpMethod,
  MCP_PROTOCOL_VERSION,
  MCP_CLIENT_NAME,
  MCP_CLIENT_VERSION,
  DEFAULT_TIMEOUT_MS,
} from "../../constants";
import { fetchMcpRpc } from "../../http";

type McpOperationConfig = {
  mcpUrl: string;
  agentKey: string;
  timeout?: number;
};

const sendJsonRpcRequest = async (
  config: McpOperationConfig,
  method: string,
  params?: Record<string, unknown>,
): Promise<unknown> => {
  const timeoutMs = config.timeout ?? DEFAULT_TIMEOUT_MS;

  return fetchMcpRpc({
    mcpUrl: config.mcpUrl,
    agentKey: config.agentKey,
    timeout: timeoutMs,
    method,
    params,
  });
};

const initializeMcp = async (
  config: McpOperationConfig,
): Promise<McpInitResult> => {
  const result = await sendJsonRpcRequest(config, McpMethod.INITIALIZE, {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: {
      name: MCP_CLIENT_NAME,
      version: MCP_CLIENT_VERSION,
    },
  });

  return result as McpInitResult;
};

const listTools = async (
  config: McpOperationConfig,
): Promise<McpTool[]> => {
  const result = await sendJsonRpcRequest(config, McpMethod.TOOLS_LIST);
  const resultObj = result as Record<string, unknown>;
  const tools = (resultObj.tools ?? []) as McpTool[];

  return tools;
};

const callTool = async (
  config: McpOperationConfig,
  name: string,
  args?: Record<string, unknown>,
): Promise<McpToolResult> => {
  const result = await sendJsonRpcRequest(config, McpMethod.TOOLS_CALL, {
    name,
    arguments: args ?? {},
  });

  return result as McpToolResult;
};

export { initializeMcp, listTools, callTool };

export type { McpOperationConfig };
