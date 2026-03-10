import type { Collection, Db } from "mongodb";
import type {
  MongoDbConfig,
  MongoDbState,
  CreateOneParams,
  CreateManyParams,
  CreateOneResult,
  CreateManyResult,
  FindOneParams,
  FindManyParams,
  CountDocumentsParams,
  DistinctParams,
  UpdateOneParams,
  UpdateManyParams,
  FindOneAndUpdateParams,
  UpdateOneResult,
  UpdateManyResult,
  DeleteOneParams,
  DeleteManyParams,
  FindOneAndDeleteParams,
  DeleteOneResult,
  DeleteManyResult,
} from "./types";

import { Logger } from "cau-logger";

import {
  connect,
  close,
  isConnected,
  ensureConnected,
} from "./operations/connect";
import {
  createOne as opCreateOne,
  createMany as opCreateMany,
} from "./operations/create";
import {
  findOne as opFindOne,
  findMany as opFindMany,
  countDocuments as opCountDocuments,
  distinct as opDistinct,
} from "./operations/read";
import {
  updateOne as opUpdateOne,
  updateMany as opUpdateMany,
  findOneAndUpdate as opFindOneAndUpdate,
} from "./operations/update";
import {
  deleteOne as opDeleteOne,
  deleteMany as opDeleteMany,
  findOneAndDelete as opFindOneAndDelete,
} from "./operations/delete";

const buildDefaultLogger = (): Logger => {
  return Logger.create({
    context: "cauMongodb",
    transports: [{ type: "console" }],
  });
};

class MongoDb {
  static #instance: MongoDb | null = null;

  #state: MongoDbState;

  private constructor(state: MongoDbState) {
    this.#state = state;
  }

  static create = (config: MongoDbConfig): MongoDb => {
    const logger = config.logger ?? buildDefaultLogger();

    const state: MongoDbState = {
      client: null,
      db: null,
      logger,
      config,
    };

    const instance = new MongoDb(state);

    MongoDb.#instance = instance;

    return instance;
  };

  static getInstance = (): MongoDb => {
    const isNotInitialized = MongoDb.#instance === null;

    if (isNotInitialized) {
      throw new Error("MongoDb not initialized. Call MongoDb.create() first.");
    }

    return MongoDb.#instance!;
  };

  connect = async (): Promise<void> => {
    await connect(this.#state);
  };

  close = async (): Promise<void> => {
    const isSingleton = MongoDb.#instance === this;
    if (isSingleton) {
      MongoDb.#instance = null;
    }

    await close(this.#state);
  };

  isConnected = (): boolean => {
    return isConnected(this.#state);
  };

  collection = (name: string): Collection => {
    const db = this.#state.db;
    const isNotReady = db === null;

    if (isNotReady) {
      throw new Error(
        "MongoDb is not connected. Call connect() or perform a CRUD operation first.",
      );
    }

    return db!.collection(name);
  };

  #ensureDb = async (): Promise<Db> => {
    await ensureConnected(this.#state);
    return this.#state.db!;
  };

  createOne = async <T extends Record<string, unknown>>(
    params: CreateOneParams<T>,
  ): Promise<CreateOneResult> => {
    const db = await this.#ensureDb();
    return opCreateOne(db, this.#state.logger, params);
  };

  createMany = async <T extends Record<string, unknown>>(
    params: CreateManyParams<T>,
  ): Promise<CreateManyResult> => {
    const db = await this.#ensureDb();
    return opCreateMany(db, this.#state.logger, params);
  };

  findOne = async <T>(params: FindOneParams<T>): Promise<T | null> => {
    const db = await this.#ensureDb();
    return opFindOne(db, this.#state.logger, params);
  };

  findMany = async <T>(params: FindManyParams<T>): Promise<T[]> => {
    const db = await this.#ensureDb();
    return opFindMany(db, this.#state.logger, params);
  };

  countDocuments = async (params: CountDocumentsParams): Promise<number> => {
    const db = await this.#ensureDb();
    return opCountDocuments(db, this.#state.logger, params);
  };

  distinct = async <T>(params: DistinctParams<T>): Promise<T[]> => {
    const db = await this.#ensureDb();
    return opDistinct(db, this.#state.logger, params);
  };

  updateOne = async <T>(
    params: UpdateOneParams<T>,
  ): Promise<UpdateOneResult> => {
    const db = await this.#ensureDb();
    return opUpdateOne(db, this.#state.logger, params);
  };

  updateMany = async <T>(
    params: UpdateManyParams<T>,
  ): Promise<UpdateManyResult> => {
    const db = await this.#ensureDb();
    return opUpdateMany(db, this.#state.logger, params);
  };

  findOneAndUpdate = async <T>(
    params: FindOneAndUpdateParams<T>,
  ): Promise<T | null> => {
    const db = await this.#ensureDb();
    return opFindOneAndUpdate(db, this.#state.logger, params);
  };

  deleteOne = async (params: DeleteOneParams): Promise<DeleteOneResult> => {
    const db = await this.#ensureDb();
    return opDeleteOne(db, this.#state.logger, params);
  };

  deleteMany = async (params: DeleteManyParams): Promise<DeleteManyResult> => {
    const db = await this.#ensureDb();
    return opDeleteMany(db, this.#state.logger, params);
  };

  findOneAndDelete = async <T>(
    params: FindOneAndDeleteParams<T>,
  ): Promise<T | null> => {
    const db = await this.#ensureDb();
    return opFindOneAndDelete(db, this.#state.logger, params);
  };
}

export { MongoDb };
