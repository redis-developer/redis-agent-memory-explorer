const DEFAULT_ADMIN_API_URL = "https://cloud.redis.io/context-surfaces";
const DEFAULT_MCP_URL = "https://gcp-us-east4.context-surfaces.redis.io/mcp";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const JSONRPC_VERSION = "2.0";
const MCP_PROTOCOL_VERSION = "2024-11-05";
const MCP_CLIENT_NAME = "cau-context-surfaces";
const MCP_CLIENT_VERSION = "0.1.0";
const DATA_LOAD_ENDPOINT_TEMPLATE = "/api/v1/context-surfaces/{surfaceId}/data";

const IndexType = {
  TEXT: "text",
  TAG: "tag",
  NUMERIC: "numeric",
  VECTOR: "vector",
} as const;
type IndexType = (typeof IndexType)[keyof typeof IndexType];

const DistanceMetric = {
  COSINE: "cosine",
  EUCLIDEAN: "euclidean",
  INNER_PRODUCT: "inner_product",
} as const;
type DistanceMetric = (typeof DistanceMetric)[keyof typeof DistanceMetric];

const OnConflict = {
  OVERWRITE: "overwrite",
  SKIP: "skip",
  ERROR: "error",
} as const;
type OnConflict = (typeof OnConflict)[keyof typeof OnConflict];

const OnError = {
  CONTINUE: "continue",
  FAIL_FAST: "fail_fast",
} as const;
type OnError = (typeof OnError)[keyof typeof OnError];

const McpMethod = {
  INITIALIZE: "initialize",
  TOOLS_LIST: "tools/list",
  TOOLS_CALL: "tools/call",
} as const;
type McpMethod = (typeof McpMethod)[keyof typeof McpMethod];

export {
  DEFAULT_ADMIN_API_URL,
  DEFAULT_MCP_URL,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
  JSONRPC_VERSION,
  MCP_PROTOCOL_VERSION,
  MCP_CLIENT_NAME,
  MCP_CLIENT_VERSION,
  DATA_LOAD_ENDPOINT_TEMPLATE,
  IndexType,
  DistanceMetric,
  OnConflict,
  OnError,
  McpMethod,
};
