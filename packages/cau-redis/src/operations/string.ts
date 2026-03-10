import type { Logger } from "cau-logger";
import type { RedisClientType } from "redis";
import type {
  StringSetParams,
  StringGetParams,
  StringGetSetParams,
  StringSetExParams,
  StringMSetParams,
  StringMGetParams,
  StringIncrParams,
  StringDecrParams,
  StringAppendParams,
} from "../types";

import { DEFAULT_INCR_BY } from "../constants";

const set = async (
  client: RedisClientType,
  logger: Logger,
  params: StringSetParams,
): Promise<boolean> => {
  const options: Record<string, unknown> = {};

  const hasTtl = params.ttlSec !== undefined;
  if (hasTtl) {
    options.EX = params.ttlSec;
  }

  const hasNx = params.nx === true;
  if (hasNx) {
    options.NX = true;
  }

  const hasXx = params.xx === true;
  if (hasXx) {
    options.XX = true;
  }

  const result = await client.set(params.key, params.value, options);
  logger.debug("redis SET", { key: params.key });

  return result === "OK";
};

const get = async (
  client: RedisClientType,
  logger: Logger,
  params: StringGetParams,
): Promise<string | null> => {
  const result = await client.get(params.key);
  logger.debug("redis GET", { key: params.key });

  return result;
};

const getSet = async (
  client: RedisClientType,
  logger: Logger,
  params: StringGetSetParams,
): Promise<string | null> => {
  const result = await client.getSet(params.key, params.value);
  logger.debug("redis GETSET", { key: params.key });

  return result;
};

const setEx = async (
  client: RedisClientType,
  logger: Logger,
  params: StringSetExParams,
): Promise<boolean> => {
  const result = await client.setEx(params.key, params.ttlSec, params.value);
  logger.debug("redis SETEX", { key: params.key, ttlSec: params.ttlSec });

  return result === "OK";
};

const mSet = async (
  client: RedisClientType,
  logger: Logger,
  params: StringMSetParams,
): Promise<boolean> => {
  const entries = Object.entries(params.entries).flatMap(([k, v]) => [k, v]);
  const result = await client.mSet(entries);
  logger.debug("redis MSET", { keyCount: Object.keys(params.entries).length });

  return result === "OK";
};

const mGet = async (
  client: RedisClientType,
  logger: Logger,
  params: StringMGetParams,
): Promise<(string | null)[]> => {
  const result = await client.mGet(params.keys);
  logger.debug("redis MGET", { keyCount: params.keys.length });

  return result;
};

const incr = async (
  client: RedisClientType,
  logger: Logger,
  params: StringIncrParams,
): Promise<number> => {
  const by = params.by ?? DEFAULT_INCR_BY;
  const result = await client.incrBy(params.key, by);
  logger.debug("redis INCRBY", { key: params.key, by });

  return result;
};

const decr = async (
  client: RedisClientType,
  logger: Logger,
  params: StringDecrParams,
): Promise<number> => {
  const by = params.by ?? DEFAULT_INCR_BY;
  const result = await client.decrBy(params.key, by);
  logger.debug("redis DECRBY", { key: params.key, by });

  return result;
};

const append = async (
  client: RedisClientType,
  logger: Logger,
  params: StringAppendParams,
): Promise<number> => {
  const result = await client.append(params.key, params.value);
  logger.debug("redis APPEND", { key: params.key });

  return result;
};

export { set, get, getSet, setEx, mSet, mGet, incr, decr, append };
