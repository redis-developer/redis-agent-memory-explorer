import type { Logger } from "cau-logger";
import type { Db } from "mongodb";
import type {
  CreateOneParams,
  CreateManyParams,
  CreateOneResult,
  CreateManyResult,
} from "../types";

import { validateWithSchema, validateManyWithSchema } from "../helpers/validate-params.util";
import { applyCreateFields, applyCreateFieldsMany } from "../helpers/auto-fields.util";

const createOne = async <T extends Record<string, unknown>>(
  db: Db,
  logger: Logger,
  params: CreateOneParams<T>,
): Promise<CreateOneResult> => {
  const startTime = Date.now();
  logger.debug("CRUD operation start", {
    collection: params.collection,
    operation: "createOne",
  });

  const validated = params.schema
    ? validateWithSchema(params.doc, params.schema, {
        collection: params.collection,
        operation: "createOne",
        logger,
      })
    : params.doc;

  const docWithFields = applyCreateFields(validated as Record<string, unknown>);
  const collection = db.collection(params.collection);
  const nativeResult = await collection.insertOne(docWithFields);

  const result: CreateOneResult = {
    insertedId: nativeResult.insertedId.toString(),
    acknowledged: nativeResult.acknowledged,
  };

  const durationMs = Date.now() - startTime;
  logger.debug("CRUD operation success", {
    collection: params.collection,
    operation: "createOne",
    durationMs,
    insertedId: result.insertedId,
  });

  return result;
};

const createMany = async <T extends Record<string, unknown>>(
  db: Db,
  logger: Logger,
  params: CreateManyParams<T>,
): Promise<CreateManyResult> => {
  const startTime = Date.now();
  logger.debug("CRUD operation start", {
    collection: params.collection,
    operation: "createMany",
  });

  const validated = params.schema
    ? validateManyWithSchema(params.docs, params.schema, {
        collection: params.collection,
        operation: "createMany",
        logger,
      })
    : params.docs;

  const docsWithFields = applyCreateFieldsMany(validated as Record<string, unknown>[]);
  const collection = db.collection(params.collection);
  const nativeResult = await collection.insertMany(docsWithFields, {
    ordered: params.ordered ?? true,
  });

  const insertedIds = Object.values(nativeResult.insertedIds).map((id) =>
    id.toString(),
  );

  const result: CreateManyResult = {
    insertedIds,
    insertedCount: nativeResult.insertedCount,
    acknowledged: nativeResult.acknowledged,
  };

  const durationMs = Date.now() - startTime;
  logger.debug("CRUD operation success", {
    collection: params.collection,
    operation: "createMany",
    durationMs,
    insertedCount: result.insertedCount,
  });

  return result;
};

export { createOne, createMany };
