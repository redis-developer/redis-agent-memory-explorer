import type { ZodIssue, ZodType } from "zod";
import type { Logger } from "cau-logger";
import type { Db, Collection } from "mongodb";

import type { DocumentStatus } from "./constants";

type MongoDbConfig = {
  uri: string;
  database: string;
  logger?: Logger;
  connectTimeoutMs?: number;
  maxPoolSize?: number;
  minPoolSize?: number;
};

type AutoFields = {
  status: DocumentStatus;
  createdAt: Date;
  updatedAt: Date;
};

type ValidationContext = {
  collection: string;
  operation: string;
  logger: Logger;
};

type CreateOneParams<T> = {
  collection: string;
  doc: T;
  schema?: ZodType<T>;
};

type CreateManyParams<T> = {
  collection: string;
  docs: T[];
  schema?: ZodType<T>;
  ordered?: boolean;
};

type FindOneParams<T> = {
  collection: string;
  filter: Record<string, unknown>;
  projection?: Record<string, 0 | 1>;
  schema?: ZodType<T>;
};

type FindManyParams<T> = {
  collection: string;
  filter: Record<string, unknown>;
  projection?: Record<string, 0 | 1>;
  sort?: Record<string, 1 | -1>;
  limit?: number;
  skip?: number;
  schema?: ZodType<T>;
};

type CountDocumentsParams = {
  collection: string;
  filter?: Record<string, unknown>;
};

type DistinctParams<T> = {
  collection: string;
  field: string;
  filter?: Record<string, unknown>;
  schema?: ZodType<T>;
};

type UpdateOneParams<T> = {
  collection: string;
  filter: Record<string, unknown>;
  update: Record<string, unknown>;
  schema?: ZodType<T>;
  upsert?: boolean;
};

type UpdateManyParams<T> = {
  collection: string;
  filter: Record<string, unknown>;
  update: Record<string, unknown>;
  schema?: ZodType<T>;
  upsert?: boolean;
};

type FindOneAndUpdateParams<T> = {
  collection: string;
  filter: Record<string, unknown>;
  update: Record<string, unknown>;
  schema?: ZodType<T>;
  upsert?: boolean;
};

type DeleteOneParams = {
  collection: string;
  filter: Record<string, unknown>;
};

type DeleteManyParams = {
  collection: string;
  filter: Record<string, unknown>;
};

type FindOneAndDeleteParams<T> = {
  collection: string;
  filter: Record<string, unknown>;
  schema?: ZodType<T>;
};

type CreateOneResult = {
  insertedId: string;
  acknowledged: boolean;
};

type CreateManyResult = {
  insertedIds: string[];
  insertedCount: number;
  acknowledged: boolean;
};

type UpdateOneResult = {
  matchedCount: number;
  modifiedCount: number;
  upsertedId: string | null;
  acknowledged: boolean;
};

type UpdateManyResult = {
  matchedCount: number;
  modifiedCount: number;
  upsertedCount: number;
  acknowledged: boolean;
};

type DeleteOneResult = {
  deletedCount: number;
  acknowledged: boolean;
};

type DeleteManyResult = {
  deletedCount: number;
  acknowledged: boolean;
};

type MongoDbState = {
  client: import("mongodb").MongoClient | null;
  db: Db | null;
  logger: Logger;
  config: MongoDbConfig;
};

export type {
  MongoDbConfig,
  AutoFields,
  ValidationContext,
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
  MongoDbState,
};
