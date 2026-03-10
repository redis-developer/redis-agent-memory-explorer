import type { Logger } from "cau-logger";
import type { RedisClientType } from "redis";
import type {
  JsonSetParams,
  JsonGetParams,
  JsonDelParams,
  JsonMGetParams,
  JsonArrAppendParams,
  JsonNumIncrByParams,
} from "../types";

import { DEFAULT_JSON_PATH } from "../constants";

const jsonSet = async (
  client: RedisClientType,
  logger: Logger,
  params: JsonSetParams,
): Promise<boolean> => {
  const path = params.path ?? DEFAULT_JSON_PATH;
  const options: Record<string, unknown> = {};

  const hasNx = params.nx === true;
  if (hasNx) {
    options.NX = true;
  }

  const hasXx = params.xx === true;
  if (hasXx) {
    options.XX = true;
  }

  const jsonValue = params.value as import("redis").RedisJSON;
  const result = await client.json.set(params.key, path, jsonValue, options);
  logger.debug("redis JSON.SET", { key: params.key, path });

  return result === "OK";
};

const unwrapJsonPathResult = <T>(result: unknown): T | null => {
  const isNull = result === null || result === undefined;
  const isWrappedArray = Array.isArray(result) && result.length === 1;

  const unwrapped = isNull
    ? null
    : isWrappedArray
      ? (result[0] as T)
      : (result as T);

  return unwrapped;
};

const jsonGet = async <T = unknown>(
  client: RedisClientType,
  logger: Logger,
  params: JsonGetParams,
): Promise<T | null> => {
  const path = params.path ?? DEFAULT_JSON_PATH;
  const result = await client.json.get(params.key, { path });
  logger.debug("redis JSON.GET", { key: params.key, path });

  return unwrapJsonPathResult<T>(result);
};

const jsonDel = async (
  client: RedisClientType,
  logger: Logger,
  params: JsonDelParams,
): Promise<number> => {
  const path = params.path ?? DEFAULT_JSON_PATH;
  const result = await client.json.del(params.key, { path });
  logger.debug("redis JSON.DEL", { key: params.key, path });

  return result;
};

const jsonMGet = async <T = unknown>(
  client: RedisClientType,
  logger: Logger,
  params: JsonMGetParams,
): Promise<(T | null)[]> => {
  const path = params.path ?? DEFAULT_JSON_PATH;
  const result = await client.json.mGet(params.keys, path);
  logger.debug("redis JSON.MGET", { keyCount: params.keys.length, path });

  return result.map((item) => unwrapJsonPathResult<T>(item));
};

const jsonArrAppend = async (
  client: RedisClientType,
  logger: Logger,
  params: JsonArrAppendParams,
): Promise<number> => {
  type RedisJSON = import("redis").RedisJSON;
  const jsonValues = params.values as RedisJSON[];
  const [first, ...rest] = jsonValues;
  const result = await client.json.arrAppend(
    params.key,
    params.path,
    first,
    ...rest,
  );
  logger.debug("redis JSON.ARRAPPEND", {
    key: params.key,
    path: params.path,
    count: params.values.length,
  });

  const length = Array.isArray(result) ? result[0] ?? 0 : (result as number);

  return length;
};

const jsonNumIncrBy = async (
  client: RedisClientType,
  logger: Logger,
  params: JsonNumIncrByParams,
): Promise<number> => {
  const result = await client.json.numIncrBy(
    params.key,
    params.path,
    params.by,
  );
  logger.debug("redis JSON.NUMINCRBY", {
    key: params.key,
    path: params.path,
    by: params.by,
  });

  const value = Array.isArray(result) ? result[0] ?? 0 : (result as number);

  return value;
};

export { jsonSet, jsonGet, jsonDel, jsonMGet, jsonArrAppend, jsonNumIncrBy };
