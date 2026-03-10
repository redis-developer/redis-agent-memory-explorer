import type { Logger } from "cau-logger";
import type { RedisClientType } from "redis";
import type { PipelineCommand, PipelineResult } from "../types";

import { DEFAULT_JSON_PATH, DEFAULT_INCR_BY } from "../constants";

const addCommandToMulti = (
  multi: ReturnType<RedisClientType["multi"]>,
  cmd: PipelineCommand,
): void => {
  switch (cmd.op) {
    case "set": {
      const options: Record<string, unknown> = {};
      const hasTtl = cmd.params.ttlSec !== undefined;
      if (hasTtl) {
        options.EX = cmd.params.ttlSec;
      }
      const hasNx = cmd.params.nx === true;
      if (hasNx) {
        options.NX = true;
      }
      const hasXx = cmd.params.xx === true;
      if (hasXx) {
        options.XX = true;
      }
      multi.set(cmd.params.key, cmd.params.value, options);
      break;
    }
    case "get": {
      multi.get(cmd.params.key);
      break;
    }
    case "del": {
      multi.del(cmd.params.keys);
      break;
    }
    case "jsonSet": {
      const path = cmd.params.path ?? DEFAULT_JSON_PATH;
      multi.json.set(cmd.params.key, path, cmd.params.value);
      break;
    }
    case "jsonGet": {
      const path = cmd.params.path ?? DEFAULT_JSON_PATH;
      multi.json.get(cmd.params.key, { path });
      break;
    }
    case "hSet": {
      const entries = Object.entries(cmd.params.fields).flatMap(([k, v]) => [
        k,
        v,
      ]);
      multi.hSet(cmd.params.key, entries);
      break;
    }
    case "hGet": {
      multi.hGet(cmd.params.key, cmd.params.field);
      break;
    }
    case "expire": {
      multi.expire(cmd.params.key, cmd.params.ttlSec);
      break;
    }
  }
};

const executePipeline = async (
  client: RedisClientType,
  logger: Logger,
  commands: PipelineCommand[],
): Promise<PipelineResult> => {
  const multi = client.multi();

  for (const cmd of commands) {
    addCommandToMulti(multi, cmd);
  }

  const results = await multi.exec();

  logger.debug("redis MULTI/EXEC pipeline", { commandCount: commands.length });

  return {
    results: results as unknown[],
    aborted: false,
  };
};

export { executePipeline };
