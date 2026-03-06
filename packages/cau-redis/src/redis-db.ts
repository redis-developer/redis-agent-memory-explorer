import type { RedisClientType } from "redis";
import type { Logger } from "cau-logger";
import type {
  RedisDbConfig,
  RedisDbState,
  StringSetParams,
  StringGetParams,
  StringGetSetParams,
  StringSetExParams,
  StringMSetParams,
  StringMGetParams,
  StringIncrParams,
  StringDecrParams,
  StringAppendParams,
  JsonSetParams,
  JsonGetParams,
  JsonDelParams,
  JsonMGetParams,
  JsonArrAppendParams,
  JsonNumIncrByParams,
  HashSetParams,
  HashGetParams,
  HashGetAllParams,
  HashDelParams,
  HashExistsParams,
  HashKeysParams,
  HashValsParams,
  HashIncrByParams,
  KeyExistsParams,
  KeyDelParams,
  KeyExpireParams,
  KeyTtlParams,
  KeyPExpireParams,
  KeyPTtlParams,
  KeyRenameParams,
  KeyTypeParams,
  KeyScanParams,
  KeyScanResult,
  PipelineCommand,
  PipelineResult,
  SubscribeParams,
  PublishParams,
  UnsubscribeParams,
} from "./types";

import { Logger as CauLogger } from "cau-logger";

import {
  connect,
  close,
  isConnected as opIsConnected,
} from "./operations/connect";
import {
  set as opSet,
  get as opGet,
  getSet as opGetSet,
  setEx as opSetEx,
  mSet as opMSet,
  mGet as opMGet,
  incr as opIncr,
  decr as opDecr,
  append as opAppend,
} from "./operations/string";
import {
  jsonSet as opJsonSet,
  jsonGet as opJsonGet,
  jsonDel as opJsonDel,
  jsonMGet as opJsonMGet,
  jsonArrAppend as opJsonArrAppend,
  jsonNumIncrBy as opJsonNumIncrBy,
} from "./operations/json";
import {
  hSet as opHSet,
  hGet as opHGet,
  hGetAll as opHGetAll,
  hDel as opHDel,
  hExists as opHExists,
  hKeys as opHKeys,
  hVals as opHVals,
  hIncrBy as opHIncrBy,
} from "./operations/hash";
import {
  exists as opExists,
  del as opDel,
  expire as opExpire,
  ttl as opTtl,
  pExpire as opPExpire,
  pTtl as opPTtl,
  rename as opRename,
  type as opType,
  scan as opScan,
} from "./operations/key";
import { executePipeline as opExecutePipeline } from "./operations/pipeline";
import {
  subscribe as opSubscribe,
  publish as opPublish,
  unsubscribe as opUnsubscribe,
} from "./operations/pubsub";
import {
  ping as opPing,
  dbSize as opDbSize,
  info as opInfo,
  flushDb as opFlushDb,
} from "./operations/health";

const buildDefaultLogger = (): Logger => {
  return CauLogger.create({
    context: "cauRedis",
    transports: [{ type: "console" }],
  });
};

const getClientOrThrow = (state: RedisDbState): RedisClientType => {
  const isReady = state.client !== null && state.client.isOpen;

  if (!isReady) {
    throw new Error(
      "RedisDb is not connected. Call connect() before performing operations.",
    );
  }

  return state.client!;
};

class RedisDb {
  static #instance: RedisDb | null = null;

  #state: RedisDbState;

  private constructor(state: RedisDbState) {
    this.#state = state;
  }

  static create = (config?: RedisDbConfig): RedisDb => {
    const resolvedConfig = config ?? {};
    const logger = resolvedConfig.logger ?? buildDefaultLogger();

    const state: RedisDbState = {
      client: null,
      subscriberClient: null,
      logger,
      config: resolvedConfig,
    };

    const instance = new RedisDb(state);
    RedisDb.#instance = instance;

    return instance;
  };

  static getInstance = (): RedisDb => {
    const isNotInitialized = RedisDb.#instance === null;

    if (isNotInitialized) {
      throw new Error("RedisDb not initialized. Call RedisDb.create() first.");
    }

    return RedisDb.#instance!;
  };

  //#region Lifecycle

  connect = async (): Promise<void> => {
    await connect(this.#state);
  };

  close = async (): Promise<void> => {
    const isSingleton = RedisDb.#instance === this;
    if (isSingleton) {
      RedisDb.#instance = null;
    }

    await close(this.#state);
  };

  isConnected = (): boolean => {
    return opIsConnected(this.#state);
  };

  getClient = (): RedisClientType => {
    return getClientOrThrow(this.#state);
  };
  //#endregion

  //#region String Operations

  set = async (params: StringSetParams): Promise<boolean> => {
    const client = getClientOrThrow(this.#state);
    return opSet(client, this.#state.logger, params);
  };

  get = async (params: StringGetParams): Promise<string | null> => {
    const client = getClientOrThrow(this.#state);
    return opGet(client, this.#state.logger, params);
  };

  getSet = async (params: StringGetSetParams): Promise<string | null> => {
    const client = getClientOrThrow(this.#state);
    return opGetSet(client, this.#state.logger, params);
  };

  setEx = async (params: StringSetExParams): Promise<boolean> => {
    const client = getClientOrThrow(this.#state);
    return opSetEx(client, this.#state.logger, params);
  };

  mSet = async (params: StringMSetParams): Promise<boolean> => {
    const client = getClientOrThrow(this.#state);
    return opMSet(client, this.#state.logger, params);
  };

  mGet = async (params: StringMGetParams): Promise<(string | null)[]> => {
    const client = getClientOrThrow(this.#state);
    return opMGet(client, this.#state.logger, params);
  };

  incr = async (params: StringIncrParams): Promise<number> => {
    const client = getClientOrThrow(this.#state);
    return opIncr(client, this.#state.logger, params);
  };

  decr = async (params: StringDecrParams): Promise<number> => {
    const client = getClientOrThrow(this.#state);
    return opDecr(client, this.#state.logger, params);
  };

  append = async (params: StringAppendParams): Promise<number> => {
    const client = getClientOrThrow(this.#state);
    return opAppend(client, this.#state.logger, params);
  };
  //#endregion

  //#region JSON Operations

  jsonSet = async (params: JsonSetParams): Promise<boolean> => {
    const client = getClientOrThrow(this.#state);
    return opJsonSet(client, this.#state.logger, params);
  };

  jsonGet = async <T = unknown>(params: JsonGetParams): Promise<T | null> => {
    const client = getClientOrThrow(this.#state);
    return opJsonGet<T>(client, this.#state.logger, params);
  };

  jsonDel = async (params: JsonDelParams): Promise<number> => {
    const client = getClientOrThrow(this.#state);
    return opJsonDel(client, this.#state.logger, params);
  };

  jsonMGet = async <T = unknown>(
    params: JsonMGetParams,
  ): Promise<(T | null)[]> => {
    const client = getClientOrThrow(this.#state);
    return opJsonMGet<T>(client, this.#state.logger, params);
  };

  jsonArrAppend = async (params: JsonArrAppendParams): Promise<number> => {
    const client = getClientOrThrow(this.#state);
    return opJsonArrAppend(client, this.#state.logger, params);
  };

  jsonNumIncrBy = async (params: JsonNumIncrByParams): Promise<number> => {
    const client = getClientOrThrow(this.#state);
    return opJsonNumIncrBy(client, this.#state.logger, params);
  };

  //#endregion
  //#region Hash Operations

  hSet = async (params: HashSetParams): Promise<number> => {
    const client = getClientOrThrow(this.#state);
    return opHSet(client, this.#state.logger, params);
  };

  hGet = async (params: HashGetParams): Promise<string | null> => {
    const client = getClientOrThrow(this.#state);
    return opHGet(client, this.#state.logger, params);
  };

  hGetAll = async (
    params: HashGetAllParams,
  ): Promise<Record<string, string>> => {
    const client = getClientOrThrow(this.#state);
    return opHGetAll(client, this.#state.logger, params);
  };

  hDel = async (params: HashDelParams): Promise<number> => {
    const client = getClientOrThrow(this.#state);
    return opHDel(client, this.#state.logger, params);
  };

  hExists = async (params: HashExistsParams): Promise<boolean> => {
    const client = getClientOrThrow(this.#state);
    return opHExists(client, this.#state.logger, params);
  };

  hKeys = async (params: HashKeysParams): Promise<string[]> => {
    const client = getClientOrThrow(this.#state);
    return opHKeys(client, this.#state.logger, params);
  };

  hVals = async (params: HashValsParams): Promise<string[]> => {
    const client = getClientOrThrow(this.#state);
    return opHVals(client, this.#state.logger, params);
  };

  hIncrBy = async (params: HashIncrByParams): Promise<number> => {
    const client = getClientOrThrow(this.#state);
    return opHIncrBy(client, this.#state.logger, params);
  };
  //#endregion

  //#region Key Operations

  exists = async (params: KeyExistsParams): Promise<boolean> => {
    const client = getClientOrThrow(this.#state);
    return opExists(client, this.#state.logger, params);
  };

  del = async (params: KeyDelParams): Promise<number> => {
    const client = getClientOrThrow(this.#state);
    return opDel(client, this.#state.logger, params);
  };

  expire = async (params: KeyExpireParams): Promise<boolean> => {
    const client = getClientOrThrow(this.#state);
    return opExpire(client, this.#state.logger, params);
  };

  ttl = async (params: KeyTtlParams): Promise<number> => {
    const client = getClientOrThrow(this.#state);
    return opTtl(client, this.#state.logger, params);
  };

  pExpire = async (params: KeyPExpireParams): Promise<boolean> => {
    const client = getClientOrThrow(this.#state);
    return opPExpire(client, this.#state.logger, params);
  };

  pTtl = async (params: KeyPTtlParams): Promise<number> => {
    const client = getClientOrThrow(this.#state);
    return opPTtl(client, this.#state.logger, params);
  };

  rename = async (params: KeyRenameParams): Promise<boolean> => {
    const client = getClientOrThrow(this.#state);
    return opRename(client, this.#state.logger, params);
  };

  type = async (params: KeyTypeParams): Promise<string> => {
    const client = getClientOrThrow(this.#state);
    return opType(client, this.#state.logger, params);
  };

  scan = async (params: KeyScanParams): Promise<KeyScanResult> => {
    const client = getClientOrThrow(this.#state);
    return opScan(client, this.#state.logger, params);
  };
  //#endregion

  //#region Pipeline

  executePipeline = async (
    commands: PipelineCommand[],
  ): Promise<PipelineResult> => {
    const client = getClientOrThrow(this.#state);
    return opExecutePipeline(client, this.#state.logger, commands);
  };
  //#endregion

  //#region Pub/Sub

  subscribe = async (params: SubscribeParams): Promise<void> => {
    await opSubscribe(this.#state, params);
  };

  publish = async (params: PublishParams): Promise<number> => {
    const client = getClientOrThrow(this.#state);
    return opPublish(client, this.#state.logger, params);
  };

  unsubscribe = async (params: UnsubscribeParams): Promise<void> => {
    await opUnsubscribe(this.#state, params);
  };
  //#endregion

  //#region Health

  ping = async (): Promise<boolean> => {
    const client = getClientOrThrow(this.#state);
    return opPing(client, this.#state.logger);
  };

  dbSize = async (): Promise<number> => {
    const client = getClientOrThrow(this.#state);
    return opDbSize(client, this.#state.logger);
  };

  info = async (): Promise<string> => {
    const client = getClientOrThrow(this.#state);
    return opInfo(client, this.#state.logger);
  };

  flushDb = async (): Promise<boolean> => {
    const client = getClientOrThrow(this.#state);
    return opFlushDb(client, this.#state.logger);
  };
  //#endregion
}

export { RedisDb };
