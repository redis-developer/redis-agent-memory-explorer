import type { Logger } from "cau-logger";
import type { Db } from "mongodb";
import type {
  UpdateOneParams,
  UpdateManyParams,
  FindOneAndUpdateParams,
  UpdateOneResult,
  UpdateManyResult,
} from "../types";

import { validateWithSchema } from "../helpers/validate-params.util";
import { buildUpdateOptions } from "../helpers/build-options.util";
import { applyUpdateFields, applyActiveFilter } from "../helpers/auto-fields.util";
import { MongoDbConflictError } from "../errors";

const hasUpdatedAtInFilter = (filter: Record<string, unknown>): boolean => {
  return "updatedAt" in filter;
};

const checkConflict = (
  matchedCount: number,
  filter: Record<string, unknown>,
  collection: string,
  operation: string,
  logger: Logger,
): void => {
  const isConflict = hasUpdatedAtInFilter(filter) && matchedCount === 0;

  if (isConflict) {
    logger.warn("Conflict detected", {
      collection,
      operation,
      filter,
      message: "Document was modified by another process since last read",
    });
    throw new MongoDbConflictError(collection, operation, filter);
  }
};

const validateUpdatePayload = <T>(
  update: Record<string, unknown>,
  schema: import("zod").ZodType<T> | undefined,
  collection: string,
  operation: string,
  logger: Logger,
): void => {
  const hasSchemaAndSetData = schema && update.$set;

  if (hasSchemaAndSetData) {
    validateWithSchema(update.$set, schema, {
      collection,
      operation,
      logger,
    });
  }
};

const updateOne = async <T>(
  db: Db,
  logger: Logger,
  params: UpdateOneParams<T>,
): Promise<UpdateOneResult> => {
  const startTime = Date.now();
  logger.debug("CRUD operation start", {
    collection: params.collection,
    operation: "updateOne",
    filter: params.filter,
  });

  validateUpdatePayload(params.update, params.schema, params.collection, "updateOne", logger);

  const activeFilter = applyActiveFilter(params.filter);
  const enrichedUpdate = applyUpdateFields(params.update);
  const options = buildUpdateOptions({ upsert: params.upsert });
  const collection = db.collection(params.collection);

  const nativeResult = await collection.updateOne(activeFilter, enrichedUpdate, options);

  checkConflict(nativeResult.matchedCount, params.filter, params.collection, "updateOne", logger);

  const result: UpdateOneResult = {
    matchedCount: nativeResult.matchedCount,
    modifiedCount: nativeResult.modifiedCount,
    upsertedId: nativeResult.upsertedId?.toString() ?? null,
    acknowledged: nativeResult.acknowledged,
  };

  const durationMs = Date.now() - startTime;
  logger.debug("CRUD operation success", {
    collection: params.collection,
    operation: "updateOne",
    durationMs,
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
  });

  return result;
};

const updateMany = async <T>(
  db: Db,
  logger: Logger,
  params: UpdateManyParams<T>,
): Promise<UpdateManyResult> => {
  const startTime = Date.now();
  logger.debug("CRUD operation start", {
    collection: params.collection,
    operation: "updateMany",
    filter: params.filter,
  });

  validateUpdatePayload(params.update, params.schema, params.collection, "updateMany", logger);

  const activeFilter = applyActiveFilter(params.filter);
  const enrichedUpdate = applyUpdateFields(params.update);
  const options = buildUpdateOptions({ upsert: params.upsert });
  const collection = db.collection(params.collection);

  const nativeResult = await collection.updateMany(activeFilter, enrichedUpdate, options);

  const result: UpdateManyResult = {
    matchedCount: nativeResult.matchedCount,
    modifiedCount: nativeResult.modifiedCount,
    upsertedCount: nativeResult.upsertedCount,
    acknowledged: nativeResult.acknowledged,
  };

  const durationMs = Date.now() - startTime;
  logger.debug("CRUD operation success", {
    collection: params.collection,
    operation: "updateMany",
    durationMs,
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
  });

  return result;
};

const findOneAndUpdate = async <T>(
  db: Db,
  logger: Logger,
  params: FindOneAndUpdateParams<T>,
): Promise<T | null> => {
  const startTime = Date.now();
  logger.debug("CRUD operation start", {
    collection: params.collection,
    operation: "findOneAndUpdate",
    filter: params.filter,
  });

  validateUpdatePayload(params.update, params.schema, params.collection, "findOneAndUpdate", logger);

  const activeFilter = applyActiveFilter(params.filter);
  const enrichedUpdate = applyUpdateFields(params.update);
  const collection = db.collection(params.collection);

  const nativeResult = await collection.findOneAndUpdate(
    activeFilter,
    enrichedUpdate,
    {
      returnDocument: "after",
      upsert: params.upsert ?? false,
    },
  );

  const matchedCount = nativeResult === null ? 0 : 1;
  checkConflict(matchedCount, params.filter, params.collection, "findOneAndUpdate", logger);

  const result = nativeResult === null
    ? null
    : params.schema
      ? validateWithSchema(nativeResult, params.schema, {
          collection: params.collection,
          operation: "findOneAndUpdate",
          logger,
        })
      : (nativeResult as T);

  const durationMs = Date.now() - startTime;
  logger.debug("CRUD operation success", {
    collection: params.collection,
    operation: "findOneAndUpdate",
    durationMs,
    found: result !== null,
  });

  return result;
};

export { updateOne, updateMany, findOneAndUpdate };
