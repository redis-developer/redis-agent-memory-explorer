import type { AutoFields } from "../types";

import { DocumentStatus } from "../constants";

const applyCreateFields = <T extends Record<string, unknown>>(
  doc: T,
): T & AutoFields => {
  const now = new Date();

  return {
    status: DocumentStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
    ...doc,
  } as T & AutoFields;
};

const applyCreateFieldsMany = <T extends Record<string, unknown>>(
  docs: T[],
): (T & AutoFields)[] => {
  return docs.map((doc) => applyCreateFields(doc));
};

const applyUpdateFields = (
  update: Record<string, unknown>,
): Record<string, unknown> => {
  const $set = (update.$set ?? {}) as Record<string, unknown>;

  const mergedSet = {
    updatedAt: new Date(),
    ...$set,
  };

  return {
    ...update,
    $set: mergedSet,
  };
};

const applyActiveFilter = (
  filter: Record<string, unknown>,
): Record<string, unknown> => {
  return {
    status: DocumentStatus.ACTIVE,
    ...filter,
  };
};

const buildSoftDeleteUpdate = (): Record<string, unknown> => {
  return {
    $set: {
      status: DocumentStatus.INACTIVE,
      updatedAt: new Date(),
    },
  };
};

export {
  applyCreateFields,
  applyCreateFieldsMany,
  applyUpdateFields,
  applyActiveFilter,
  buildSoftDeleteUpdate,
};
