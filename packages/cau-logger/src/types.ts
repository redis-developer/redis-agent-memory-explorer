type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "silent";

type LogMethod = (msg: string, data?: Record<string, unknown>) => void;

type ConsoleTransportConfig = {
  type: "console";
  level?: LogLevel;
  format?: "pretty" | "json";
  colorize?: boolean;
  destination?: "stdout" | "stderr";
};

type FileTransportConfig = {
  type: "file";
  level?: LogLevel;
  path: string;
  rotation?: "daily" | "hourly" | number;
  maxSize?: string | number;
  maxFiles?: number;
  mkdir?: boolean;
};

type MongoTransportConfig = {
  type: "mongo";
  level?: LogLevel;
  uri: string;
  database: string;
  collection?: string;
  batchSize?: number;
  flushInterval?: number;
};

type SqlTransportConfig = {
  type: "sql";
  level?: LogLevel;
  connection: Record<string, unknown>;
  table?: string;
  batchSize?: number;
  flushInterval?: number;
};

type TransportConfig =
  | ConsoleTransportConfig
  | FileTransportConfig
  | MongoTransportConfig
  | SqlTransportConfig;

type LoggerConfig = {
  level?: LogLevel;
  context?: string;
  redact?: string[];
  transports?: TransportConfig[];
  timestamp?: boolean;
};

type MongoTransportOptions = {
  uri: string;
  database: string;
  collection: string;
  batchSize: number;
  flushInterval: number;
};

type SqlTransportOptions = {
  knexConfig: Record<string, unknown>;
  table: string;
  batchSize: number;
  flushInterval: number;
};

export type {
  LogLevel,
  LogMethod,
  ConsoleTransportConfig,
  FileTransportConfig,
  MongoTransportConfig,
  SqlTransportConfig,
  TransportConfig,
  LoggerConfig,
  MongoTransportOptions,
  SqlTransportOptions,
};
