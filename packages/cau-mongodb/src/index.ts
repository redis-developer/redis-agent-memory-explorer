import type {
  MongoDbConfig,
  CreateOneParams,
  CreateManyParams,
  FindOneParams,
  FindManyParams,
  CountDocumentsParams,
  DistinctParams,
  UpdateOneParams,
  UpdateManyParams,
  FindOneAndUpdateParams,
  DeleteOneParams,
  DeleteManyParams,
  FindOneAndDeleteParams,
  CreateOneResult,
  CreateManyResult,
  UpdateOneResult,
  UpdateManyResult,
  DeleteOneResult,
  DeleteManyResult,
} from "./types";

import { MongoDb } from "./mongo-db";
import { DocumentStatus } from "./constants";
import { MongoDbValidationError, MongoDbConflictError } from "./errors";

export { MongoDb, DocumentStatus, MongoDbValidationError, MongoDbConflictError };

export type {
  MongoDbConfig,
  CreateOneParams,
  CreateManyParams,
  FindOneParams,
  FindManyParams,
  CountDocumentsParams,
  DistinctParams,
  UpdateOneParams,
  UpdateManyParams,
  FindOneAndUpdateParams,
  DeleteOneParams,
  DeleteManyParams,
  FindOneAndDeleteParams,
  CreateOneResult,
  CreateManyResult,
  UpdateOneResult,
  UpdateManyResult,
  DeleteOneResult,
  DeleteManyResult,
};
