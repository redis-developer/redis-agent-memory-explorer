import type { Logger } from "cau-logger";
import type { RedisClientType } from "redis";
import type {
  HashSetParams,
  HashGetParams,
  HashGetAllParams,
  HashDelParams,
  HashExistsParams,
  HashKeysParams,
  HashValsParams,
  HashIncrByParams,
} from "../types";

const hSet = async (
  client: RedisClientType,
  logger: Logger,
  params: HashSetParams,
): Promise<number> => {
  const entries = Object.entries(params.fields).flatMap(([k, v]) => [k, v]);
  const result = await client.hSet(params.key, entries);
  logger.debug("redis HSET", {
    key: params.key,
    fieldCount: Object.keys(params.fields).length,
  });

  return result;
};

const hGet = async (
  client: RedisClientType,
  logger: Logger,
  params: HashGetParams,
): Promise<string | null> => {
  const result = await client.hGet(params.key, params.field);
  logger.debug("redis HGET", { key: params.key, field: params.field });

  const value = result === undefined ? null : result;

  return value;
};

const hGetAll = async (
  client: RedisClientType,
  logger: Logger,
  params: HashGetAllParams,
): Promise<Record<string, string>> => {
  const result = await client.hGetAll(params.key);
  logger.debug("redis HGETALL", { key: params.key });

  return result;
};

const hDel = async (
  client: RedisClientType,
  logger: Logger,
  params: HashDelParams,
): Promise<number> => {
  const result = await client.hDel(params.key, params.fields);
  logger.debug("redis HDEL", {
    key: params.key,
    fieldCount: params.fields.length,
  });

  return result;
};

const hExists = async (
  client: RedisClientType,
  logger: Logger,
  params: HashExistsParams,
): Promise<boolean> => {
  const result = await client.hExists(params.key, params.field);
  logger.debug("redis HEXISTS", { key: params.key, field: params.field });

  return result === 1;
};

const hKeys = async (
  client: RedisClientType,
  logger: Logger,
  params: HashKeysParams,
): Promise<string[]> => {
  const result = await client.hKeys(params.key);
  logger.debug("redis HKEYS", { key: params.key });

  return result;
};

const hVals = async (
  client: RedisClientType,
  logger: Logger,
  params: HashValsParams,
): Promise<string[]> => {
  const result = await client.hVals(params.key);
  logger.debug("redis HVALS", { key: params.key });

  return result;
};

const hIncrBy = async (
  client: RedisClientType,
  logger: Logger,
  params: HashIncrByParams,
): Promise<number> => {
  const result = await client.hIncrBy(params.key, params.field, params.by);
  logger.debug("redis HINCRBY", {
    key: params.key,
    field: params.field,
    by: params.by,
  });

  return result;
};

export { hSet, hGet, hGetAll, hDel, hExists, hKeys, hVals, hIncrBy };
