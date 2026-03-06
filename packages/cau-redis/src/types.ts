import type { Logger } from "cau-logger";
import type { RedisClientType } from "redis";

type RedisDbConfig = {
  url?: string;
  connectTimeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  disableOfflineQueue?: boolean;
  logger?: Logger;
};

type RedisDbState = {
  client: RedisClientType | null;
  subscriberClient: RedisClientType | null;
  logger: Logger;
  config: RedisDbConfig;
};

// --- String operation params ---

type StringSetParams = {
  key: string;
  value: string;
  ttlSec?: number;
  nx?: boolean;
  xx?: boolean;
};

type StringGetParams = {
  key: string;
};

type StringGetSetParams = {
  key: string;
  value: string;
};

type StringSetExParams = {
  key: string;
  value: string;
  ttlSec: number;
};

type StringMSetParams = {
  entries: Record<string, string>;
};

type StringMGetParams = {
  keys: string[];
};

type StringIncrParams = {
  key: string;
  by?: number;
};

type StringDecrParams = {
  key: string;
  by?: number;
};

type StringAppendParams = {
  key: string;
  value: string;
};

// --- JSON operation params ---

type JsonSetParams = {
  key: string;
  path?: string;
  value: unknown;
  nx?: boolean;
  xx?: boolean;
};

type JsonGetParams = {
  key: string;
  path?: string;
};

type JsonDelParams = {
  key: string;
  path?: string;
};

type JsonMGetParams = {
  keys: string[];
  path?: string;
};

type JsonArrAppendParams = {
  key: string;
  path: string;
  values: unknown[];
};

type JsonNumIncrByParams = {
  key: string;
  path: string;
  by: number;
};

// --- Hash operation params ---

type HashSetParams = {
  key: string;
  fields: Record<string, string>;
};

type HashGetParams = {
  key: string;
  field: string;
};

type HashGetAllParams = {
  key: string;
};

type HashDelParams = {
  key: string;
  fields: string[];
};

type HashExistsParams = {
  key: string;
  field: string;
};

type HashKeysParams = {
  key: string;
};

type HashValsParams = {
  key: string;
};

type HashIncrByParams = {
  key: string;
  field: string;
  by: number;
};

// --- Key operation params ---

type KeyExistsParams = {
  key: string;
};

type KeyDelParams = {
  keys: string[];
};

type KeyExpireParams = {
  key: string;
  ttlSec: number;
};

type KeyTtlParams = {
  key: string;
};

type KeyPExpireParams = {
  key: string;
  ttlMs: number;
};

type KeyPTtlParams = {
  key: string;
};

type KeyRenameParams = {
  key: string;
  newKey: string;
};

type KeyTypeParams = {
  key: string;
};

type KeyScanParams = {
  pattern?: string;
  count?: number;
  cursor?: number;
};

type KeyScanResult = {
  cursor: number;
  keys: string[];
};

// --- Pipeline ---

type PipelineCommand =
  | { op: "set"; params: StringSetParams }
  | { op: "get"; params: StringGetParams }
  | { op: "del"; params: KeyDelParams }
  | { op: "jsonSet"; params: JsonSetParams }
  | { op: "jsonGet"; params: JsonGetParams }
  | { op: "hSet"; params: HashSetParams }
  | { op: "hGet"; params: HashGetParams }
  | { op: "expire"; params: KeyExpireParams };

type PipelineResult = {
  results: unknown[];
  aborted: boolean;
};

// --- Pub/Sub ---

type SubscribeParams = {
  channel: string;
  onMessage: (message: string, channel: string) => void;
};

type PublishParams = {
  channel: string;
  message: string;
};

type UnsubscribeParams = {
  channel: string;
};

export type {
  RedisDbConfig,
  RedisDbState,
  StringSetParams,
  StringGetParams,
  StringGetSetParams,
  StringSetExParams,
  StringMSetParams,
  StringMGetParams,
  StringIncrParams,
  StringDecrParams,
  StringAppendParams,
  JsonSetParams,
  JsonGetParams,
  JsonDelParams,
  JsonMGetParams,
  JsonArrAppendParams,
  JsonNumIncrByParams,
  HashSetParams,
  HashGetParams,
  HashGetAllParams,
  HashDelParams,
  HashExistsParams,
  HashKeysParams,
  HashValsParams,
  HashIncrByParams,
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
  PipelineCommand,
  PipelineResult,
  SubscribeParams,
  PublishParams,
  UnsubscribeParams,
};
