import pino from "pino";

import type { Logger as PinoLogger } from "pino";

import { buildTargets } from "./helpers/build-targets.util";
import { DEFAULT_LOG_LEVEL } from "./constants";

import type { LoggerConfig, LogLevel, CauLogger } from "./types";

const DEFAULT_TRANSPORTS = [{ type: "console" as const }];

const wrapLogger = (
  instance: PinoLogger,
  transport: ReturnType<typeof pino.transport>,
): CauLogger => ({
  trace: ((...args: unknown[]) =>
    (instance.trace as Function).apply(instance, args)) as CauLogger["trace"],
  debug: ((...args: unknown[]) =>
    (instance.debug as Function).apply(instance, args)) as CauLogger["debug"],
  info: ((...args: unknown[]) =>
    (instance.info as Function).apply(instance, args)) as CauLogger["info"],
  warn: ((...args: unknown[]) =>
    (instance.warn as Function).apply(instance, args)) as CauLogger["warn"],
  error: ((...args: unknown[]) =>
    (instance.error as Function).apply(instance, args)) as CauLogger["error"],
  fatal: ((...args: unknown[]) =>
    (instance.fatal as Function).apply(instance, args)) as CauLogger["fatal"],

  child: (bindings: Record<string, unknown>): CauLogger =>
    wrapLogger(instance.child(bindings), transport),

  get level(): LogLevel {
    return instance.level as LogLevel;
  },
  set level(value: LogLevel) {
    instance.level = value;
  },

  isLevelEnabled: (level: LogLevel): boolean => instance.isLevelEnabled(level),

  flush: (): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      instance.flush((err?: Error) => (err ? reject(err) : resolve()));
    }),

  close: async (): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      instance.flush((err?: Error) => (err ? reject(err) : resolve()));
    });
    transport.end();
  },
});

const createLogger = (config?: LoggerConfig): CauLogger => {
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

  return wrapLogger(instance, transport);
};

export { createLogger };
