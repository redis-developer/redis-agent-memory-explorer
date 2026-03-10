import type { SignalHandlerDeps, SignalCleanup } from "../types";

import { GRACEFUL_SHUTDOWN_TIMEOUT_MS } from "../constants";
import { serializeError } from "./serialize-error.util";

const gracefulShutdown = async (
  signal: string,
  deps: SignalHandlerDeps,
): Promise<void> => {
  const { server, logger, onAppStop } = deps;

  logger.info(`Received ${signal}, shutting down gracefully`);

  const forceExitTimer = setTimeout(() => {
    logger.error("Graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, GRACEFUL_SHUTDOWN_TIMEOUT_MS);
  forceExitTimer.unref();

  try {
    await onAppStop?.();
  } catch (err) {
    logger.error("onAppStop callback failed", {
      error: serializeError(err),
    });
  }

  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
};

const setupSignals = (deps: SignalHandlerDeps): SignalCleanup => {
  const { logger } = deps;

  const onSigterm = (): void => {
    gracefulShutdown("SIGTERM", deps);
  };
  const onSigint = (): void => {
    gracefulShutdown("SIGINT", deps);
  };
  const onUnhandledRejection = (reason: unknown): void => {
    logger.error("Unhandled rejection", {
      error: serializeError(reason),
    });
  };
  const onUncaughtException = (err: Error): void => {
    logger.fatal("Uncaught exception -- shutting down", {
      error: serializeError(err),
    });
    gracefulShutdown("uncaughtException", deps);
  };

  process.on("SIGTERM", onSigterm);
  process.on("SIGINT", onSigint);
  process.on("unhandledRejection", onUnhandledRejection);
  process.on("uncaughtException", onUncaughtException);

  const cleanup = (): void => {
    process.removeListener("SIGTERM", onSigterm);
    process.removeListener("SIGINT", onSigint);
    process.removeListener("unhandledRejection", onUnhandledRejection);
    process.removeListener("uncaughtException", onUncaughtException);
  };

  return cleanup;
};

export { setupSignals, gracefulShutdown };
