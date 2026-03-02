import type { Logger as PinoLogger } from "pino";
import type { LogLevel } from "./constants";
import type { LoggerConfig, LogMethod } from "./types";

import pino from "pino";

import { buildTargets } from "./helpers/build-targets.util";
import { DEFAULT_LOG_LEVEL, TransportType } from "./constants";

const DEFAULT_TRANSPORTS = [{ type: TransportType.CONSOLE }];

class Logger {
  static #instance: Logger | null = null;

  #pino: PinoLogger;
  #transport: ReturnType<typeof pino.transport>;

  private constructor(
    pinoInstance: PinoLogger,
    transport: ReturnType<typeof pino.transport>,
  ) {
    this.#pino = pinoInstance;
    this.#transport = transport;
  }

  static create(config?: LoggerConfig): Logger {
    const {
      level = DEFAULT_LOG_LEVEL,
      context,
      redact,
      transports = DEFAULT_TRANSPORTS,
      timestamp = true,
    } = config ?? {};

    const targets = buildTargets(transports);
    const transport = pino.transport({ targets });

    const options: pino.LoggerOptions = {
      level,
      timestamp: timestamp ? () => `,"time":${Date.now()}` : false,
      ...(redact ? { redact } : {}),
      base: context ? { context } : {},
    };

    const instance = pino(options, transport);

    return new Logger(instance, transport);
  }

  static getInstance(config?: LoggerConfig): Logger {
    Logger.#instance ??= Logger.create(config);
    return Logger.#instance;
  }

  static reset(): void {
    Logger.#instance = null;
  }

  trace: LogMethod = (msg, data) => {
    data ? this.#pino.trace(data, msg) : this.#pino.trace(msg);
  };

  debug: LogMethod = (msg, data) => {
    data ? this.#pino.debug(data, msg) : this.#pino.debug(msg);
  };

  info: LogMethod = (msg, data) => {
    data ? this.#pino.info(data, msg) : this.#pino.info(msg);
  };

  warn: LogMethod = (msg, data) => {
    data ? this.#pino.warn(data, msg) : this.#pino.warn(msg);
  };

  error: LogMethod = (msg, data) => {
    data ? this.#pino.error(data, msg) : this.#pino.error(msg);
  };

  fatal: LogMethod = (msg, data) => {
    data ? this.#pino.fatal(data, msg) : this.#pino.fatal(msg);
  };

  child = (bindings: Record<string, unknown>): Logger =>
    new Logger(this.#pino.child(bindings), this.#transport);

  get level(): LogLevel {
    return this.#pino.level as LogLevel;
  }

  set level(value: LogLevel) {
    this.#pino.level = value;
  }

  close = async (): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      this.#pino.flush((err?: Error) => (err ? reject(err) : resolve()));
    });
    this.#transport.end();
  };
}

export { Logger };
