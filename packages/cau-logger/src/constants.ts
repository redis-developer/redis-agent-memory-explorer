const LogLevel = {
  TRACE: "trace",
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
  FATAL: "fatal",
  SILENT: "silent",
} as const;
type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

const TransportType = {
  CONSOLE: "console",
  FILE: "file",
  MONGO: "mongo",
  SQL: "sql",
} as const;
type TransportType = (typeof TransportType)[keyof typeof TransportType];

const LogFormat = {
  PRETTY: "pretty",
  JSON: "json",
} as const;
type LogFormat = (typeof LogFormat)[keyof typeof LogFormat];

const OutputDestination = {
  STDOUT: "stdout",
  STDERR: "stderr",
} as const;
type OutputDestination =
  (typeof OutputDestination)[keyof typeof OutputDestination];

const RotationInterval = {
  DAILY: "daily",
  HOURLY: "hourly",
} as const;
type RotationInterval =
  (typeof RotationInterval)[keyof typeof RotationInterval];

const DEFAULT_LOG_LEVEL = LogLevel.INFO;
const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_FLUSH_INTERVAL = 5000;
const DEFAULT_MONGO_COLLECTION = "logs";
const DEFAULT_SQL_TABLE = "logs";

export {
  LogLevel,
  TransportType,
  LogFormat,
  OutputDestination,
  RotationInterval,
  DEFAULT_LOG_LEVEL,
  DEFAULT_BATCH_SIZE,
  DEFAULT_FLUSH_INTERVAL,
  DEFAULT_MONGO_COLLECTION,
  DEFAULT_SQL_TABLE,
};
