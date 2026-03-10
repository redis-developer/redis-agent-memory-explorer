import type {
  LogMethod,
  ConsoleTransportConfig,
  FileTransportConfig,
  MongoTransportConfig,
  SqlTransportConfig,
  TransportConfig,
  LoggerConfig,
} from "./types";

import { Logger } from "./logger";
import {
  LogLevel,
  TransportType,
  LogFormat,
  OutputDestination,
  RotationInterval,
} from "./constants";

export {
  Logger,
  LogLevel,
  TransportType,
  LogFormat,
  OutputDestination,
  RotationInterval,
};

export type {
  LogMethod,
  ConsoleTransportConfig,
  FileTransportConfig,
  MongoTransportConfig,
  SqlTransportConfig,
  TransportConfig,
  LoggerConfig,
};
