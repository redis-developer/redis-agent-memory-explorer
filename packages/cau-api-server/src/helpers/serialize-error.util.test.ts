import { describe, it, expect } from "vitest";

import { serializeError } from "./serialize-error.util";

describe("serializeError", () => {
  it("should serialize a standard Error to { message, name, stack }", () => {
    const msg = "something went wrong";
    const err = new Error(msg);
    const result = serializeError(err);

    expect(result.message).toBe(msg);
    expect(result.name).toBe("Error");
    expect(result.stack).toBeDefined();
    expect(typeof result.stack).toBe("string");
  });

  it("should preserve custom enumerable properties from error subclasses", () => {
    class HttpError extends Error {
      statusCode: number;
      code: string;
      constructor(message: string, statusCode: number, code: string) {
        super(message);
        this.name = "HttpError";
        this.statusCode = statusCode;
        this.code = code;
      }
    }

    const msg = "resource not found";
    const statusCode = 404;
    const code = "NOT_FOUND";
    const err = new HttpError(msg, statusCode, code);
    const result = serializeError(err);

    expect(result.message).toBe(msg);
    expect(result.name).toBe("HttpError");
    expect(result.statusCode).toBe(statusCode);
    expect(result.code).toBe(code);
    expect(result.stack).toBeDefined();
  });

  it("should serialize a string value safely", () => {
    const input = "plain string error";
    const result = serializeError(input);

    expect(result.message).toBe(input);
    expect(result.name).toBe("UnknownError");
    expect(result.stack).toBeUndefined();
  });

  it("should serialize a number value safely", () => {
    const input = 42;
    const result = serializeError(input);

    expect(result.message).toBe("42");
    expect(result.name).toBe("UnknownError");
  });

  it("should serialize null safely", () => {
    const result = serializeError(null);

    expect(result.message).toBe("null");
    expect(result.name).toBe("UnknownError");
  });

  it("should serialize undefined safely", () => {
    const result = serializeError(undefined);

    expect(result.message).toBe("undefined");
    expect(result.name).toBe("UnknownError");
  });

  it("should never produce [object Object] in the message field", () => {
    const inputs = [
      new Error("test"),
      "string",
      42,
      null,
      undefined,
      { custom: "object" },
    ];

    for (const input of inputs) {
      const result = serializeError(input);
      expect(result.message).not.toBe("[object Object]");
      expect(JSON.stringify(result)).not.toBe("{}");
    }
  });
});
