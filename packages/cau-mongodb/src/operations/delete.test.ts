import type { MongoDbState } from "../types";

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Logger } from "cau-logger";
import { ObjectId } from "mongodb";

import { deleteOne, deleteMany, findOneAndDelete } from "./delete";
import { createOne, createMany } from "./create";
import { findOne, findMany, countDocuments } from "./read";
import { connect, close } from "./connect";
import { ENV } from "../config";
import { DocumentStatus } from "../constants";

const TEST_COLLECTION = "test_delete";

const logger = Logger.create({
  context: "delete-test",
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

describe("delete operations (soft delete)", () => {
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

  describe("deleteOne", () => {
    it("should soft-delete a document by setting status to INACTIVE", async () => {
      const created = await createOne(state.db!, logger, {
        collection: TEST_COLLECTION,
        doc: { name: "ToDelete" },
      });

      const result = await deleteOne(state.db!, logger, {
        collection: TEST_COLLECTION,
        filter: { _id: new ObjectId(created.insertedId) },
      });

      expect(result.acknowledged).toBe(true);
      expect(result.deletedCount).toBe(1);

      const raw = await state.db!
        .collection(TEST_COLLECTION)
        .findOne({ _id: new ObjectId(created.insertedId) });

      expect(raw).not.toBeNull();
      expect(raw!.status).toBe(DocumentStatus.INACTIVE);
    });

    it("should make the soft-deleted document invisible to findOne", async () => {
      const created = await createOne(state.db!, logger, {
        collection: TEST_COLLECTION,
        doc: { name: "Invisible" },
      });

      await deleteOne(state.db!, logger, {
        collection: TEST_COLLECTION,
        filter: { _id: new ObjectId(created.insertedId) },
      });

      const found = await findOne(state.db!, logger, {
        collection: TEST_COLLECTION,
        filter: { _id: new ObjectId(created.insertedId) },
      });

      expect(found).toBeNull();
    });
  });

  describe("deleteMany", () => {
    it("should soft-delete multiple documents", async () => {
      await createMany(state.db!, logger, {
        collection: TEST_COLLECTION,
        docs: [
          { name: "Del1", category: "batch" },
          { name: "Del2", category: "batch" },
          { name: "Keep", category: "other" },
        ],
      });

      const result = await deleteMany(state.db!, logger, {
        collection: TEST_COLLECTION,
        filter: { category: "batch" },
      });

      expect(result.deletedCount).toBe(2);

      const activeCount = await countDocuments(state.db!, logger, {
        collection: TEST_COLLECTION,
      });

      expect(activeCount).toBe(1);
    });
  });

  describe("findOneAndDelete", () => {
    it("should soft-delete and return the document after status change", async () => {
      await createOne(state.db!, logger, {
        collection: TEST_COLLECTION,
        doc: { name: "FindAndDelete", value: 42 },
      });

      const result = await findOneAndDelete<Record<string, unknown>>(
        state.db!,
        logger,
        {
          collection: TEST_COLLECTION,
          filter: { name: "FindAndDelete" },
        },
      );

      expect(result).not.toBeNull();
      expect(result!.name).toBe("FindAndDelete");
      expect(result!.status).toBe(DocumentStatus.INACTIVE);
    });

    it("should return null when no document matches", async () => {
      const result = await findOneAndDelete(state.db!, logger, {
        collection: TEST_COLLECTION,
        filter: { name: "Nonexistent" },
      });

      expect(result).toBeNull();
    });

    it("should make the document invisible to subsequent reads", async () => {
      await createOne(state.db!, logger, {
        collection: TEST_COLLECTION,
        doc: { name: "GoneAfterFAD" },
      });

      await findOneAndDelete(state.db!, logger, {
        collection: TEST_COLLECTION,
        filter: { name: "GoneAfterFAD" },
      });

      const found = await findOne(state.db!, logger, {
        collection: TEST_COLLECTION,
        filter: { name: "GoneAfterFAD" },
      });

      expect(found).toBeNull();
    });
  });
});
