import type { Logger as LoggerType } from "cau-logger";

import { RedisDb } from "cau-redis";
import { Logger } from "cau-logger";

import {
  AMS_PARTITION_KEY_PREFIX,
  AMS_PARTITION_KEY_SEPARATOR,
  AMS_PARTITION_SUMMARY_SEGMENT,
  AMS_PARTITION_SCAN_BATCH,
} from "../constants";

// Workaround: https://github.com/redis/agent-memory-server/issues/229
// AMS deleteSummaryView does not clean up computed partition summaries.
// This module provides direct Redis SCAN + DEL cleanup until the fix lands.
// Key format: summary_view:{view_id}:summary:{partition_key}

let _logger: LoggerType | null = null;
const getLogger = (): LoggerType => {
  if (!_logger) {
    _logger = Logger.getInstance().child({ component: "AmsPartitionCleanup" });
  }

  return _logger;
};

const buildPartitionPattern = (viewId: string): string => {
  const parts = [
    AMS_PARTITION_KEY_PREFIX,
    viewId,
    AMS_PARTITION_SUMMARY_SEGMENT,
    "*",
  ];

  return parts.join(AMS_PARTITION_KEY_SEPARATOR);
};

const deletePartitionsForView = async (viewId: string): Promise<number> => {
  const logger = getLogger();
  const pattern = buildPartitionPattern(viewId);
  const redis = RedisDb.getInstance();

  let cursor = 0;
  let hasMore = true;
  let totalDeleted = 0;

  while (hasMore) {
    const result = await redis.scan({
      cursor,
      pattern,
      count: AMS_PARTITION_SCAN_BATCH,
    });
    cursor = result.cursor;
    hasMore = cursor !== 0;

    const hasBatchKeys = result.keys.length > 0;
    if (hasBatchKeys) {
      await redis.del({ keys: result.keys });
      totalDeleted += result.keys.length;
    }
  }

  logger.debug("Partition cleanup completed for view", {
    viewId,
    pattern,
    totalDeleted,
  });

  return totalDeleted;
};

export { deletePartitionsForView };
