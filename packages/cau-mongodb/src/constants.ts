const DEFAULT_CONNECT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_POOL_SIZE = 10;
const DEFAULT_MIN_POOL_SIZE = 1;

const DocumentStatus = {
  ACTIVE: 1,
  INACTIVE: 0,
} as const;
type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

export {
  DEFAULT_CONNECT_TIMEOUT_MS,
  DEFAULT_MAX_POOL_SIZE,
  DEFAULT_MIN_POOL_SIZE,
  DocumentStatus,
};
