import type { Logger } from "cau-logger";
import type { RedisClientType } from "redis";
import type {
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
} from "../types";

import { DEFAULT_SCAN_COUNT } from "../constants";

const exists = async (
  client: RedisClientType,
  logger: Logger,
  params: KeyExistsParams,
): Promise<boolean> => {
  const result = await client.exists(params.key);
  logger.debug("redis EXISTS", { key: params.key });

  return result === 1;
};

const del = async (
  client: RedisClientType,
  logger: Logger,
  params: KeyDelParams,
): Promise<number> => {
  const result = await client.del(params.keys);
  logger.debug("redis DEL", { keyCount: params.keys.length });

  return result;
};

const expire = async (
  client: RedisClientType,
  logger: Logger,
  params: KeyExpireParams,
): Promise<boolean> => {
  const result = await client.expire(params.key, params.ttlSec);
  logger.debug("redis EXPIRE", { key: params.key, ttlSec: params.ttlSec });

  return result === 1;
};

const ttl = async (
  client: RedisClientType,
  logger: Logger,
  params: KeyTtlParams,
): Promise<number> => {
  const result = await client.ttl(params.key);
  logger.debug("redis TTL", { key: params.key, ttl: result });

  return result;
};

const pExpire = async (
  client: RedisClientType,
  logger: Logger,
  params: KeyPExpireParams,
): Promise<boolean> => {
  const result = await client.pExpire(params.key, params.ttlMs);
  logger.debug("redis PEXPIRE", { key: params.key, ttlMs: params.ttlMs });

  return result === 1;
};

const pTtl = async (
  client: RedisClientType,
  logger: Logger,
  params: KeyPTtlParams,
): Promise<number> => {
  const result = await client.pTTL(params.key);
  logger.debug("redis PTTL", { key: params.key, pTtl: result });

  return result;
};

const rename = async (
  client: RedisClientType,
  logger: Logger,
  params: KeyRenameParams,
): Promise<boolean> => {
  const result = await client.rename(params.key, params.newKey);
  logger.debug("redis RENAME", { key: params.key, newKey: params.newKey });

  return result === "OK";
};

const type = async (
  client: RedisClientType,
  logger: Logger,
  params: KeyTypeParams,
): Promise<string> => {
  const result = await client.type(params.key);
  logger.debug("redis TYPE", { key: params.key, type: result });

  return result;
};

const scan = async (
  client: RedisClientType,
  logger: Logger,
  params: KeyScanParams,
): Promise<KeyScanResult> => {
  const cursor = params.cursor ?? 0;
  const count = params.count ?? DEFAULT_SCAN_COUNT;
  const pattern = params.pattern ?? "*";

  const result = await client.scan(String(cursor), {
    MATCH: pattern,
    COUNT: count,
  });

  logger.debug("redis SCAN", { cursor, pattern, count });

  const parsedCursor = typeof result.cursor === "string"
    ? parseInt(result.cursor, 10)
    : Number(result.cursor);

  return {
    cursor: parsedCursor,
    keys: result.keys as string[],
  };
};

export { exists, del, expire, ttl, pExpire, pTtl, rename, type, scan };
