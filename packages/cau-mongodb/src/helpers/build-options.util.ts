import type { FindOptions, UpdateOptions } from "mongodb";
import type { FindManyParams } from "../types";

const buildFindOptions = (params: FindManyParams<unknown>): FindOptions => {
  const options: FindOptions = {};

  if (params.projection) {
    options.projection = params.projection;
  }
  if (params.sort) {
    options.sort = params.sort;
  }
  if (params.limit !== undefined) {
    options.limit = params.limit;
  }
  if (params.skip !== undefined) {
    options.skip = params.skip;
  }

  return options;
};

const buildUpdateOptions = (params: {
  upsert?: boolean;
}): UpdateOptions => {
  const options: UpdateOptions = {};

  if (params.upsert !== undefined) {
    options.upsert = params.upsert;
  }

  return options;
};

export { buildFindOptions, buildUpdateOptions };
