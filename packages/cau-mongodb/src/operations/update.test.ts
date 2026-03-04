import type { MongoDbState } from "../types";

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { z } from "zod";
import { Logger } from "cau-logger";
import { ObjectId } from "mongodb";

import { updateOne, updateMany, findOneAndUpdate } from "./update";
import { createOne } from "./create";
import { connect, close } from "./connect";
import { ENV } from "../config";
import { DocumentStatus } from "../constants";
import { MongoDbConflictError, MongoDbValidationError } from "../errors";

const TEST_COLLECTION = "test_update";

const logger = Logger.create({
  context: "update-test",
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

describe("update operations", () => {
  beforeAll(async () => {
    await connect(state);
  });

  beforeEach(async () => {
    await state.db!.collection(TEST_COLLECTION).deleteMany({});
  });

  afterAll(async () => {
    await state.db!.collection(TEST_COLLECTION).deleteMany({});
    await close(state);
  });

  describe("updateOne", () => {
    it("should update a single document", async () => {
      const created = await createOne(state.db!, logger, {
        collection: TEST_COLLECTION,
        doc: { name: "Alice", age: 30 },
      });

      const result = await updateOne(state.db!, logger, {
        collection: TEST_COLLECTION,
        filter: { _id: new ObjectId(created.insertedId) },
        update: { $set: { name: "Alice Updated" } },
      });

      expect(result.acknowledged).toBe(true);
      expect(result.matchedCount).toBe(1);
      expect(result.modifiedCount).toBe(1);
    });

    it("should auto-inject updatedAt into the $set portion", async () => {
      const created = await createOne(state.db!, logger, {
        collection: TEST_COLLECTION,
        doc: { name: "Bob" },
      });

      const beforeUpdate = new Date();
      await updateOne(state.db!, logger, {
        collection: TEST_COLLECTION,
        filter: { _id: new ObjectId(created.insertedId) },
        update: { $set: { name: "Bob Updated" } },
      });

      const doc = await state.db!
        .collection(TEST_COLLECTION)
        .findOne({ _id: new ObjectId(created.insertedId) });

      expect(doc!.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });

    it("should only update active documents", async () => {
      await state.db!.collection(TEST_COLLECTION).insertOne({
        name: "Inactive",
        status: DocumentStatus.INACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await updateOne(state.db!, logger, {
        collection: TEST_COLLECTION,
        filter: { name: "Inactive" },
        update: { $set: { name: "Should Not Update" } },
      });

      expect(result.matchedCount).toBe(0);
    });

    it("should throw MongoDbConflictError when updatedAt is in filter and matchedCount is 0", async () => {
      const created = await createOne(state.db!, logger, {
        collection: TEST_COLLECTION,
        doc: { name: "Conflict Test" },
      });

      const staleDate = new Date("2000-01-01");
      let error: MongoDbConflictError | null = null;

      try {
        await updateOne(state.db!, logger, {
          collection: TEST_COLLECTION,
          filter: {
            _id: new ObjectId(created.insertedId),
            updatedAt: staleDate,
          },
          update: { $set: { name: "Should Conflict" } },
        });
      } catch (err) {
        error = err as MongoDbConflictError;
      }

      expect(error).toBeInstanceOf(MongoDbConflictError);
      expect(error!.collection).toBe(TEST_COLLECTION);
      expect(error!.operation).toBe("updateOne");
    });

    it("should not throw conflict error when updatedAt is not in filter", async () => {
      const result = await updateOne(state.db!, logger, {
        collection: TEST_COLLECTION,
        filter: { name: "Nonexistent" },
        update: { $set: { name: "No Conflict" } },
      });

      expect(result.matchedCount).toBe(0);
    });

    it("should validate $set payload with schema", async () => {
      const schema = z.object({ name: z.string().min(1) });

      await createOne(state.db!, logger, {
        collection: TEST_COLLECTION,
        doc: { name: "Schema Test" },
      });

      let error: MongoDbValidationError | null = null;

      try {
        await updateOne(state.db!, logger, {
          collection: TEST_COLLECTION,
          filter: { name: "Schema Test" },
          update: { $set: { name: "" } },
          schema,
        });
      } catch (err) {
        error = err as MongoDbValidationError;
      }

      expect(error).toBeInstanceOf(MongoDbValidationError);
    });
  });

  describe("updateMany", () => {
    it("should update multiple documents", async () => {
      await createOne(state.db!, logger, {
        collection: TEST_COLLECTION,
        doc: { name: "Batch1", category: "A" },
      });
      await createOne(state.db!, logger, {
        collection: TEST_COLLECTION,
        doc: { name: "Batch2", category: "A" },
      });

      const result = await updateMany(state.db!, logger, {
        collection: TEST_COLLECTION,
        filter: { category: "A" },
        update: { $set: { category: "B" } },
      });

      expect(result.matchedCount).toBe(2);
      expect(result.modifiedCount).toBe(2);
    });
  });

  describe("findOneAndUpdate", () => {
    it("should update and return the document after mutation", async () => {
      await createOne(state.db!, logger, {
        collection: TEST_COLLECTION,
        doc: { name: "FindAndUpdate", value: 1 },
      });

      const result = await findOneAndUpdate<Record<string, unknown>>(
        state.db!,
        logger,
        {
          collection: TEST_COLLECTION,
          filter: { name: "FindAndUpdate" },
          update: { $set: { value: 2 } },
        },
      );

      expect(result).not.toBeNull();
      expect(result!.value).toBe(2);
    });

    it("should throw MongoDbConflictError with stale updatedAt in filter", async () => {
      await createOne(state.db!, logger, {
        collection: TEST_COLLECTION,
        doc: { name: "ConflictFAU" },
      });

      const staleDate = new Date("2000-01-01");
      let error: MongoDbConflictError | null = null;

      try {
        await findOneAndUpdate(state.db!, logger, {
          collection: TEST_COLLECTION,
          filter: { name: "ConflictFAU", updatedAt: staleDate },
          update: { $set: { name: "Should Conflict" } },
        });
      } catch (err) {
        error = err as MongoDbConflictError;
      }

      expect(error).toBeInstanceOf(MongoDbConflictError);
      expect(error!.operation).toBe("findOneAndUpdate");
    });

    it("should return null when no document matches", async () => {
      const result = await findOneAndUpdate(state.db!, logger, {
        collection: TEST_COLLECTION,
        filter: { name: "Nonexistent" },
        update: { $set: { name: "No Match" } },
      });

      expect(result).toBeNull();
    });
  });
});
