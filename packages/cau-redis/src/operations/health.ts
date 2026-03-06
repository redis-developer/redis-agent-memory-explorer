import type { Logger } from "cau-logger";
import type { RedisClientType } from "redis";

const ping = async (client: RedisClientType, logger: Logger): Promise<boolean> => {
  const response = await client.ping();
  logger.debug("redis PING", { response });

  return response === "PONG";
};

const dbSize = async (client: RedisClientType, logger: Logger): Promise<number> => {
  const size = await client.dbSize();
  logger.debug("redis DBSIZE", { size });

  return size;
};

const info = async (client: RedisClientType, logger: Logger): Promise<string> => {
  const result = await client.info();
  logger.debug("redis INFO");

  return result;
};

const flushDb = async (client: RedisClientType, logger: Logger): Promise<boolean> => {
  const result = await client.flushDb();
  logger.debug("redis FLUSHDB", { result });

  return result === "OK";
};

export { ping, dbSize, info, flushDb };
