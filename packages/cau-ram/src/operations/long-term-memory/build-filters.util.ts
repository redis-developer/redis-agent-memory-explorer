import type { MemoryFilter } from "../../types";

import { FilterOp } from "../../constants";

type TagFilter = {
  eq?: string;
  ne?: string;
  in?: string[];
  all?: string[];
};

type DateFilter = {
  gt?: Date;
  lt?: Date;
  gte?: Date;
  lte?: Date;
  eq?: Date;
};

type CloudLongTermMemoryFilter = {
  sessionId?: TagFilter;
  ownerId?: TagFilter;
  namespace?: TagFilter;
  topics?: TagFilter;
  memoryType?: TagFilter;
  createdAt?: DateFilter;
};

type CloudFilterConjunction = "all" | "any";

const buildLongTermMemoryFilter = (filter?: MemoryFilter): CloudLongTermMemoryFilter | undefined => {
  if (!filter) {
    return undefined;
  }

  const cloudFilter: CloudLongTermMemoryFilter = {};

  if (filter.sessionId) {
    cloudFilter.sessionId = { eq: filter.sessionId };
  }
  if (filter.ownerId) {
    cloudFilter.ownerId = { eq: filter.ownerId };
  }
  if (filter.namespace) {
    cloudFilter.namespace = { eq: filter.namespace };
  }
  if (filter.topics && filter.topics.length > 0) {
    cloudFilter.topics = { all: filter.topics };
  }
  if (filter.memoryType) {
    cloudFilter.memoryType = { eq: filter.memoryType };
  }
  if (filter.createdAfter) {
    cloudFilter.createdAt = { gt: new Date(filter.createdAfter) };
  }
  if (filter.createdBefore) {
    cloudFilter.createdAt = {
      ...cloudFilter.createdAt,
      lt: new Date(filter.createdBefore),
    };
  }

  const hasAnyFilter = Object.keys(cloudFilter).length > 0;
  if (!hasAnyFilter) {
    return undefined;
  }

  return cloudFilter;
};

const mapFilterOp = (filterOp?: string): CloudFilterConjunction | undefined => {
  if (!filterOp) {
    return undefined;
  }
  if (filterOp === FilterOp.ALL) {
    return "all";
  }
  if (filterOp === FilterOp.ANY) {
    return "any";
  }

  return undefined;
};

export { buildLongTermMemoryFilter, mapFilterOp };
export type { CloudLongTermMemoryFilter, CloudFilterConjunction };
