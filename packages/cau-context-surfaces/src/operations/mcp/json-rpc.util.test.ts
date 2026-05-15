import { describe, it, expect, beforeEach } from "vitest";

import {
  buildJsonRpcRequest,
  parseJsonRpcResponse,
  resetRequestIdCounter,
} from "./json-rpc.util";

describe("buildJsonRpcRequest", () => {
  beforeEach(() => {
    resetRequestIdCounter();
  });

  it("should build a request with method, params, and auto-incremented id", () => {
    const request = buildJsonRpcRequest("tools/list", { filter: "active" });

    expect(request.jsonrpc).toBe("2.0");
    expect(request.method).toBe("tools/list");
    expect(request.params).toEqual({ filter: "active" });
    expect(request.id).toBe(1);
  });

  it("should build a request with empty params when none provided", () => {
    const request = buildJsonRpcRequest("tools/list");

    expect(request.params).toEqual({});
  });

  it("should use the explicit id when provided", () => {
    const request = buildJsonRpcRequest("initialize", {}, 99);

    expect(request.id).toBe(99);
  });

  it("should always include jsonrpc version 2.0", () => {
    const request = buildJsonRpcRequest("tools/call");

    expect(request.jsonrpc).toBe("2.0");
  });

  it("should auto-increment id across calls", () => {
    const first = buildJsonRpcRequest("tools/list");
    const second = buildJsonRpcRequest("tools/call");

    expect(first.id).toBe(1);
    expect(second.id).toBe(2);
  });
});

describe("parseJsonRpcResponse", () => {
  it("should extract result from a successful response", () => {
    const body = { jsonrpc: "2.0", id: 1, result: { tools: [] } };
    const parsed = parseJsonRpcResponse(body);

    expect(parsed.result).toEqual({ tools: [] });
  });

  it("should throw when response contains a JSON-RPC error object", () => {
    const body = {
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32600, message: "Invalid request" },
    };

    expect(() => parseJsonRpcResponse(body)).toThrow("JSON-RPC error");
  });

  it("should throw with error code and message from the error object", () => {
    const body = {
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32601, message: "Method not found" },
    };

    expect(() => parseJsonRpcResponse(body)).toThrow(
      "JSON-RPC error (code -32601): Method not found",
    );
  });

  it("should throw when response body is null or undefined", () => {
    expect(() => parseJsonRpcResponse(null)).toThrow(
      "JSON-RPC response body is null or undefined",
    );
    expect(() => parseJsonRpcResponse(undefined)).toThrow(
      "JSON-RPC response body is null or undefined",
    );
  });

  it("should throw when response body has no result and no error", () => {
    const body = { jsonrpc: "2.0", id: 1 };

    expect(() => parseJsonRpcResponse(body)).toThrow(
      "JSON-RPC response has no result and no error",
    );
  });

  it("should handle result that is an empty object", () => {
    const body = { jsonrpc: "2.0", id: 1, result: {} };
    const parsed = parseJsonRpcResponse(body);

    expect(parsed.result).toEqual({});
  });

  it("should handle result that contains nested objects and arrays", () => {
    const nestedResult = {
      tools: [
        { name: "search", inputSchema: { type: "object", properties: {} } },
      ],
    };
    const body = { jsonrpc: "2.0", id: 1, result: nestedResult };
    const parsed = parseJsonRpcResponse(body);

    expect(parsed.result).toEqual(nestedResult);
  });
});
