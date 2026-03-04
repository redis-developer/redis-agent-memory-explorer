import type { MongoDbState } from "../types";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { z } from "zod";
import { Logger } from "cau-logger";

import { findOne, findMany, countDocuments, distinct } from "./read";
import { createOne, createMany } from "./create";
import { connect, close } from "./connect";
import { ENV } from "../config";
import { DocumentStatus } from "../constants";

const TEST_COLLECTION = "test_read";

const logger = Logger.create({
  context: "read-test",
  transports: [{ type: "console" }],
});

const state: MongoDbState = {
  client: null,
  db: null,
  logger,
  config: {
    uri: ENV.MONGODB_URI,
    database: ENV.MONGODB_DATABASE,
  },
};

describe("read operations", () => {
  beforeAll(async () => {
    await connect(state);
    await state.db!.collection(TEST_COLLECTION).deleteMany({});

    await createMany(state.db!, logger, {
      collection: TEST_COLLECTION,
      docs: [
        { name: "Alice", email: "alice@example.com", age: 30 },
        { name: "Bob", email: "bob@example.com", age: 25 },
        { name: "Charlie", email: "charlie@example.com", age: 35 },
      ],
    });

    await state.db!.collection(TEST_COLLECTION).insertOne({
      name: "Deleted",
      email: "deleted@example.com",
      age: 40,
      status: DocumentStatus.INACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterAll(async () => {
    await state.db!.collection(TEST_COLLECTION).deleteMany({});
    await close(state);
  });

  describe("findOne", () => {
    it("should find a single document by filter", async () => {
      const result = await findOne(state.db!, logger, {
        collection: TEST_COLLECTION,
        filter: { name: "Alice" },
      });

      expect(result).not.toBeNull();
      expect((result as Record<string, unknown>).name).toBe("Alice");
    });

    it("should return null when no document matches", async () => {
      const result = await findOne(state.db!, logger, {
        collection: TEST_COLLECTION,
        filter: { name: "Nonexistent" },
      });

      expect(result).toBeNull();
    });

    it("should not return soft-deleted documents", async () => {
      const result = await findOne(state.db!, logger, {
        collection: TEST_COLLECTION,
        filter: { name: "Deleted" },
      });

      expect(result).toBeNull();
    });

    it("should apply projection", async () => {
      const result = await findOne<Record<string, unknown>>(state.db!, logger, {
        collection: TEST_COLLECTION,
        filter: { name: "Alice" },
        projection: { name: 1, _id: 0 },
      });

      expect(result).not.toBeNull();
      expect((result as Record<string, unknown>).name).toBe("Alice");
      expect((result as Record<string, unknown>)._id).toBeUndefined();
    });
  });

  describe("findMany", () => {
    it("should return all active documents matching the filter", async () => {
      const results = await findMany(state.db!, logger, {
        collection: TEST_COLLECTION,
        filter: {},
      });

      expect(results.length).toBe(3);
    });

    it("should not include soft-deleted documents", async () => {
      const results = await findMany(state.db!, logger, {
        collection: TEST_COLLECTION,
        filter: {},
      });

      const names = results.map((r: any) => r.name);
      expect(names).not.toContain("Deleted");
    });

    it("should apply sort, limit, and skip", async () => {
      const results = await findMany(state.db!, logger, {
        collection: TEST_COLLECTION,
        filter: {},
        sort: { age: 1 },
        limit: 2,
        skip: 0,
      });

      expect(results.length).toBe(2);
      expect((results[0] as Record<string, unknown>).name).toBe("Bob");
      expect((results[1] as Record<string, unknown>).name).toBe("Alice");
    });
  });

  describe("countDocuments", () => {
    it("should count only active documents", async () => {
      const count = await countDocuments(state.db!, logger, {
        collection: TEST_COLLECTION,
      });

      expect(count).toBe(3);
    });

    it("should count with a filter", async () => {
      const count = await countDocuments(state.db!, logger, {
        collection: TEST_COLLECTION,
        filter: { age: { $gte: 30 } },
      });

      expect(count).toBe(2);
    });
  });

  describe("distinct", () => {
    it("should return distinct values for a field", async () => {
      const names = await distinct(state.db!, logger, {
        collection: TEST_COLLECTION,
        field: "name",
      });

      expect(names).toHaveLength(3);
      expect(names).toContain("Alice");
      expect(names).toContain("Bob");
      expect(names).toContain("Charlie");
    });

    it("should not include values from soft-deleted documents", async () => {
      const names = await distinct(state.db!, logger, {
        collection: TEST_COLLECTION,
        field: "name",
      });

      expect(names).not.toContain("Deleted");
    });
  });
});
