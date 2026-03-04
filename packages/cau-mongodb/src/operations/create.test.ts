import type { MongoDbState } from "../types";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { z } from "zod";
import { Logger } from "cau-logger";
import { ObjectId } from "mongodb";

import { createOne, createMany } from "./create";
import { connect, close } from "./connect";
import { ENV } from "../config";
import { DocumentStatus } from "../constants";
import { MongoDbValidationError } from "../errors";

const TEST_COLLECTION = "test_create";

const logger = Logger.create({
  context: "create-test",
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

describe("create operations", () => {
  beforeAll(async () => {
    await connect(state);
    await state.db!.collection(TEST_COLLECTION).deleteMany({});
  });

  afterAll(async () => {
    await state.db!.collection(TEST_COLLECTION).deleteMany({});
    await close(state);
  });

  describe("createOne", () => {
    it("should insert a document and return insertedId", async () => {
      const result = await createOne(state.db!, logger, {
        collection: TEST_COLLECTION,
        doc: { name: "Alice", email: "alice@example.com" },
      });

      expect(result.acknowledged).toBe(true);
      expect(result.insertedId).toBeDefined();
      expect(ObjectId.isValid(result.insertedId)).toBe(true);
    });

    it("should auto-inject status, createdAt, and updatedAt", async () => {
      const result = await createOne(state.db!, logger, {
        collection: TEST_COLLECTION,
        doc: { name: "Bob" },
      });

      const doc = await state.db!
        .collection(TEST_COLLECTION)
        .findOne({ _id: new ObjectId(result.insertedId) });

      expect(doc!.status).toBe(DocumentStatus.ACTIVE);
      expect(doc!.createdAt).toBeInstanceOf(Date);
      expect(doc!.updatedAt).toBeInstanceOf(Date);
    });

    it("should validate input with Zod schema before insertion", async () => {
      const schema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
      });

      const result = await createOne(state.db!, logger, {
        collection: TEST_COLLECTION,
        doc: { name: "Charlie", email: "charlie@example.com" },
        schema,
      });

      expect(result.acknowledged).toBe(true);
    });

    it("should throw MongoDbValidationError when schema validation fails", async () => {
      const schema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
      });

      let error: MongoDbValidationError | null = null;

      try {
        await createOne(state.db!, logger, {
          collection: TEST_COLLECTION,
          doc: { name: "", email: "not-an-email" },
          schema,
        });
      } catch (err) {
        error = err as MongoDbValidationError;
      }

      expect(error).toBeInstanceOf(MongoDbValidationError);
      expect(error!.collection).toBe(TEST_COLLECTION);
      expect(error!.operation).toBe("createOne");
    });
  });

  describe("createMany", () => {
    it("should insert multiple documents and return insertedIds", async () => {
      const result = await createMany(state.db!, logger, {
        collection: TEST_COLLECTION,
        docs: [
          { name: "Doc1" },
          { name: "Doc2" },
          { name: "Doc3" },
        ],
      });

      expect(result.acknowledged).toBe(true);
      expect(result.insertedCount).toBe(3);
      expect(result.insertedIds).toHaveLength(3);
    });

    it("should auto-inject status, createdAt, and updatedAt on all documents", async () => {
      const result = await createMany(state.db!, logger, {
        collection: TEST_COLLECTION,
        docs: [{ name: "Multi1" }, { name: "Multi2" }],
      });

      const ids = result.insertedIds.map((id) => new ObjectId(id));
      const docs = await state.db!
        .collection(TEST_COLLECTION)
        .find({ _id: { $in: ids } })
        .toArray();

      docs.forEach((doc) => {
        expect(doc.status).toBe(DocumentStatus.ACTIVE);
        expect(doc.createdAt).toBeInstanceOf(Date);
        expect(doc.updatedAt).toBeInstanceOf(Date);
      });
    });

    it("should throw MongoDbValidationError when any document fails schema validation", async () => {
      const schema = z.object({
        name: z.string().min(1),
      });

      let error: MongoDbValidationError | null = null;

      try {
        await createMany(state.db!, logger, {
          collection: TEST_COLLECTION,
          docs: [{ name: "Valid" }, { name: "" }],
          schema,
        });
      } catch (err) {
        error = err as MongoDbValidationError;
      }

      expect(error).toBeInstanceOf(MongoDbValidationError);
      expect(error!.operation).toBe("createMany");
    });
  });
});
