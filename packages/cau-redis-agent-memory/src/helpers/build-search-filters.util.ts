import type { MemorySearchOptions } from "../types";
import type { SearchOptions } from "agent-memory-client";

import {
  SessionId,
  Namespace,
  UserId,
  Topics,
  Entities,
  CreatedAt,
  LastAccessed,
  EventDate,
  MemoryType as SdkMemoryType,
} from "agent-memory-client";

import { DEFAULT_SEARCH_LIMIT } from "../constants";

const toDateString = (value: Date | string): string => {
  const isDate = value instanceof Date;
  return isDate ? value.toISOString() : value;
};

/**
 * Translates `MemorySearchOptions` (our public API types) into `SearchOptions`
 * (agent-memory-client SDK types). The SDK uses Python-style naming (`in_`,
 * `not_eq`, `not_in`) while our types use idiomatic TS (`in`, `ne`, `notIn`).
 *
 * @example
 * ```ts
 * const sdkFilters = buildSearchFilters({
 *   text: "deployment issue",
 *   sessionId: { eq: "sess-abc" },
 *   topics: { any: ["infra", "deploy"] },
 *   createdAt: { gte: new Date("2025-01-01") },
 *   limit: 20,
 * });
 * ```
 */
const buildSearchFilters = (
  options: MemorySearchOptions,
): Partial<SearchOptions> => {
  const filters: Partial<SearchOptions> = {};

  const hasText = options.text !== undefined;
  if (hasText) {
    filters.text = options.text;
  }

  const hasSessionId = options.sessionId !== undefined;
  if (hasSessionId) {
    const f = options.sessionId!;
    filters.sessionId = new SessionId({
      eq: f.eq,
      in_: f.in,
      not_eq: f.ne,
      not_in: f.notIn,
    });
  }

  const hasNamespace = options.namespace !== undefined;
  if (hasNamespace) {
    const f = options.namespace!;
    filters.namespace = new Namespace({
      eq: f.eq,
      in_: f.in,
      not_eq: f.ne,
      not_in: f.notIn,
    });
  }

  const hasUserId = options.userId !== undefined;
  if (hasUserId) {
    const f = options.userId!;
    filters.userId = new UserId({
      eq: f.eq,
      in_: f.in,
      not_eq: f.ne,
      not_in: f.notIn,
    });
  }

  const hasTopics = options.topics !== undefined;
  if (hasTopics) {
    const f = options.topics!;
    filters.topics = new Topics({
      any: f.any,
      all: f.all,
      none: f.notIn,
    });
  }

  const hasEntities = options.entities !== undefined;
  if (hasEntities) {
    const f = options.entities!;
    filters.entities = new Entities({
      any: f.any,
      all: f.all,
      none: f.notIn,
    });
  }

  const hasMemoryType = options.memoryType !== undefined;
  if (hasMemoryType) {
    const f = options.memoryType!;
    filters.memoryType = new SdkMemoryType({
      eq: f.eq,
      in_: f.in,
      not_eq: f.ne,
      not_in: f.notIn,
    });
  }

  const hasCreatedAt = options.createdAt !== undefined;
  if (hasCreatedAt) {
    const f = options.createdAt!;
    filters.createdAt = new CreatedAt({
      gte: f.gte !== undefined ? toDateString(f.gte) : undefined,
      lte: f.lte !== undefined ? toDateString(f.lte) : undefined,
      eq: f.eq !== undefined ? toDateString(f.eq) : undefined,
    });
  }

  const hasLastAccessed = options.lastAccessed !== undefined;
  if (hasLastAccessed) {
    const f = options.lastAccessed!;
    filters.lastAccessed = new LastAccessed({
      gte: f.gte !== undefined ? toDateString(f.gte) : undefined,
      lte: f.lte !== undefined ? toDateString(f.lte) : undefined,
      eq: f.eq !== undefined ? toDateString(f.eq) : undefined,
    });
  }

  const hasEventDate = options.eventDate !== undefined;
  if (hasEventDate) {
    const f = options.eventDate!;
    filters.eventDate = new EventDate({
      gte: f.gte !== undefined ? toDateString(f.gte) : undefined,
      lte: f.lte !== undefined ? toDateString(f.lte) : undefined,
      eq: f.eq !== undefined ? toDateString(f.eq) : undefined,
    });
  }

  const hasDistanceThreshold = options.distanceThreshold !== undefined;
  if (hasDistanceThreshold) {
    filters.distanceThreshold = options.distanceThreshold;
  }

  filters.limit = options.limit ?? DEFAULT_SEARCH_LIMIT;

  const hasOffset = options.offset !== undefined;
  if (hasOffset) {
    filters.offset = options.offset;
  }

  const hasRecencyBoost = options.recencyBoost !== undefined;
  if (hasRecencyBoost) {
    filters.recency = { recency_boost: options.recencyBoost };
  }

  const hasOptimizeQuery = options.optimizeQuery !== undefined;
  if (hasOptimizeQuery) {
    filters.optimizeQuery = options.optimizeQuery;
  }

  return filters;
};

export { buildSearchFilters };
