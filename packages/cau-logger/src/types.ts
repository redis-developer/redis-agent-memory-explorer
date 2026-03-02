type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "silent";

type LogMethod = {
  (msg: string, ...args: unknown[]): void;
  (obj: Record<string, unknown>, msg?: string, ...args: unknown[]): void;
};

type CauLogger = {
  trace: LogMethod;
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  fatal: LogMethod;

  child: (bindings: Record<string, unknown>) => CauLogger;

  level: LogLevel;
  isLevelEnabled: (level: LogLevel) => boolean;

  flush: () => Promise<void>;
  close: () => Promise<void>;
};

type ConsoleTransportConfig = {
  type: "console";
  level?: LogLevel;
  pretty?: boolean;
  colorize?: boolean;
  destination?: "stdout" | "stderr";
};

type FileTransportConfig = {
  type: "file";
  level?: LogLevel;
  path: string;
  frequency?: "daily" | "hourly" | number;
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
  knexConfig: Record<string, unknown>;
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
  CauLogger,
  ConsoleTransportConfig,
  FileTransportConfig,
  MongoTransportConfig,
  SqlTransportConfig,
  TransportConfig,
  LoggerConfig,
  MongoTransportOptions,
  SqlTransportOptions,
};
