import type { Logger } from "cau-logger";
import type { Db } from "mongodb";
import type {
  DeleteOneParams,
  DeleteManyParams,
  FindOneAndDeleteParams,
  DeleteOneResult,
  DeleteManyResult,
} from "../types";

import { validateWithSchema } from "../helpers/validate-params.util";
import { applyActiveFilter, buildSoftDeleteUpdate } from "../helpers/auto-fields.util";

const deleteOne = async (
  db: Db,
  logger: Logger,
  params: DeleteOneParams,
): Promise<DeleteOneResult> => {
  const startTime = Date.now();
  logger.debug("CRUD operation start", {
    collection: params.collection,
    operation: "deleteOne",
    filter: params.filter,
  });

  const activeFilter = applyActiveFilter(params.filter);
  const softDeleteUpdate = buildSoftDeleteUpdate();
  const collection = db.collection(params.collection);

  const nativeResult = await collection.updateOne(activeFilter, softDeleteUpdate);

  const result: DeleteOneResult = {
    deletedCount: nativeResult.modifiedCount,
    acknowledged: nativeResult.acknowledged,
  };

  const durationMs = Date.now() - startTime;
  logger.debug("CRUD operation success", {
    collection: params.collection,
    operation: "deleteOne",
    durationMs,
    deletedCount: result.deletedCount,
  });

  return result;
};

const deleteMany = async (
  db: Db,
  logger: Logger,
  params: DeleteManyParams,
): Promise<DeleteManyResult> => {
  const startTime = Date.now();
  logger.debug("CRUD operation start", {
    collection: params.collection,
    operation: "deleteMany",
    filter: params.filter,
  });

  const activeFilter = applyActiveFilter(params.filter);
  const softDeleteUpdate = buildSoftDeleteUpdate();
  const collection = db.collection(params.collection);

  const nativeResult = await collection.updateMany(activeFilter, softDeleteUpdate);

  const result: DeleteManyResult = {
    deletedCount: nativeResult.modifiedCount,
    acknowledged: nativeResult.acknowledged,
  };

  const durationMs = Date.now() - startTime;
  logger.debug("CRUD operation success", {
    collection: params.collection,
    operation: "deleteMany",
    durationMs,
    deletedCount: result.deletedCount,
  });

  return result;
};

const findOneAndDelete = async <T>(
  db: Db,
  logger: Logger,
  params: FindOneAndDeleteParams<T>,
): Promise<T | null> => {
  const startTime = Date.now();
  logger.debug("CRUD operation start", {
    collection: params.collection,
    operation: "findOneAndDelete",
    filter: params.filter,
  });

  const activeFilter = applyActiveFilter(params.filter);
  const softDeleteUpdate = buildSoftDeleteUpdate();
  const collection = db.collection(params.collection);

  const nativeResult = await collection.findOneAndUpdate(
    activeFilter,
    softDeleteUpdate,
    { returnDocument: "after" },
  );

  const result = nativeResult === null
    ? null
    : params.schema
      ? validateWithSchema(nativeResult, params.schema, {
          collection: params.collection,
          operation: "findOneAndDelete",
          logger,
        })
      : (nativeResult as T);

  const durationMs = Date.now() - startTime;
  logger.debug("CRUD operation success", {
    collection: params.collection,
    operation: "findOneAndDelete",
    durationMs,
    found: result !== null,
  });

  return result;
};

export { deleteOne, deleteMany, findOneAndDelete };
