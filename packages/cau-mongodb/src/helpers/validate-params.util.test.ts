import type { ValidationContext } from "../types";

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { Logger } from "cau-logger";

import { validateWithSchema, validateManyWithSchema } from "./validate-params.util";
import { MongoDbValidationError } from "../errors";

const logger = Logger.create({ context: "validate-params-test", transports: [{ type: "console" }] });

const buildContext = (operation: string): ValidationContext => ({
  collection: "test_collection",
  operation,
  logger,
});

describe("validateWithSchema", () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().int().positive(),
  });

  it("should return parsed data when input is valid", () => {
    const input = { name: "Alice", age: 30 };
    const result = validateWithSchema(input, schema, buildContext("createOne"));
    expect(result).toEqual(input);
  });

  it("should strip unknown fields via schema transform", () => {
    const strictSchema = z.object({ name: z.string() }).strict();
    const input = { name: "Alice", extra: "field" };
    let threw = false;

    try {
      validateWithSchema(input, strictSchema, buildContext("createOne"));
    } catch {
      threw = true;
    }

    expect(threw).toBe(true);
  });

  it("should throw MongoDbValidationError with correct fields when input is invalid", () => {
    const input = { name: "", age: -5 };
    let error: MongoDbValidationError | null = null;

    try {
      validateWithSchema(input, schema, buildContext("createOne"));
    } catch (err) {
      error = err as MongoDbValidationError;
    }

    expect(error).toBeInstanceOf(MongoDbValidationError);
    expect(error!.collection).toBe("test_collection");
    expect(error!.operation).toBe("createOne");
    expect(error!.issues.length).toBeGreaterThan(0);
  });

  it("should include Zod issues in the thrown error", () => {
    const input = { name: 123, age: "not a number" };
    let error: MongoDbValidationError | null = null;

    try {
      validateWithSchema(input, schema, buildContext("findOne"));
    } catch (err) {
      error = err as MongoDbValidationError;
    }

    expect(error).toBeInstanceOf(MongoDbValidationError);
    expect(error!.issues.length).toBe(2);
  });
});

describe("validateManyWithSchema", () => {
  const schema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
  });

  it("should return all parsed documents when all are valid", () => {
    const docs = [
      { name: "Alice", email: "alice@example.com" },
      { name: "Bob", email: "bob@example.com" },
    ];
    const result = validateManyWithSchema(docs, schema, buildContext("createMany"));
    expect(result).toEqual(docs);
  });

  it("should throw MongoDbValidationError collecting issues from all invalid documents", () => {
    const docs = [
      { name: "", email: "invalid" },
      { name: "Bob", email: "bob@example.com" },
      { name: "", email: "also-invalid" },
    ];
    let error: MongoDbValidationError | null = null;

    try {
      validateManyWithSchema(docs, schema, buildContext("createMany"));
    } catch (err) {
      error = err as MongoDbValidationError;
    }

    expect(error).toBeInstanceOf(MongoDbValidationError);
    expect(error!.issues.length).toBeGreaterThanOrEqual(4);
    const indexPaths = error!.issues.map((i) => i.path[0]);
    expect(indexPaths).toContain(0);
    expect(indexPaths).toContain(2);
  });

  it("should prefix issue paths with the document index", () => {
    const docs = [
      { name: "Alice", email: "alice@example.com" },
      { name: "", email: "invalid" },
    ];
    let error: MongoDbValidationError | null = null;

    try {
      validateManyWithSchema(docs, schema, buildContext("createMany"));
    } catch (err) {
      error = err as MongoDbValidationError;
    }

    expect(error).toBeInstanceOf(MongoDbValidationError);
    error!.issues.forEach((issue) => {
      expect(issue.path[0]).toBe(1);
    });
  });
});
