import type { Server as HttpServer } from "node:http";
import type {
  ApiServerConfig,
  InternalConfig,
  ApiResponse,
  Application,
  SignalCleanup,
} from "./types";

import express, { Router } from "express";
import { Logger } from "cau-logger";

import { setupSecurity } from "./helpers/setup-security.util";
import { createRequestIdMiddleware } from "./helpers/request-id.util";
import { registerRoutes } from "./helpers/register-routes.util";
import { setupSignals } from "./helpers/setup-signals.util";
import { ENV } from "./config";
import {
  DEFAULT_BODY_LIMIT,
  DEFAULT_RATE_LIMIT_WINDOW_MS,
  DEFAULT_RATE_LIMIT_MAX,
  HEALTH_ENDPOINT_PATH,
  HTTP_STATUS_CODES,
} from "./constants";

const DEFAULT_LOGGER_CONTEXT = "ApiServer";

const buildInternalConfig = (input: ApiServerConfig): InternalConfig => {
  const {
    config: serverConfig,
    logger,
    onAppStart,
    onAppStop,
    routes,
  } = input;

  const resolvedLogger =
    logger ??
    Logger.create({
      context: DEFAULT_LOGGER_CONTEXT,
      transports: [{ type: "console" }],
    });

  return {
    port: serverConfig?.PORT ?? ENV.PORT,
    apiPrefix: serverConfig?.API_PREFIX ?? ENV.API_PREFIX,
    allowedOrigins: serverConfig?.ALLOWED_ORIGINS ?? [],
    bodyLimit: serverConfig?.BODY_LIMIT ?? DEFAULT_BODY_LIMIT,
    rateLimitWindowMs:
      serverConfig?.RATE_LIMIT_WINDOW_MS ?? DEFAULT_RATE_LIMIT_WINDOW_MS,
    rateLimitMax: serverConfig?.RATE_LIMIT_MAX ?? DEFAULT_RATE_LIMIT_MAX,
    logger: resolvedLogger,
    onAppStart,
    onAppStop,
    routes,
  };
};

const buildExpressApp = (config: InternalConfig): Application => {
  const app = express();

  setupSecurity(app, {
    allowedOrigins: config.allowedOrigins,
    bodyLimit: config.bodyLimit,
    rateLimitWindowMs: config.rateLimitWindowMs,
    rateLimitMax: config.rateLimitMax,
  });

  app.use(createRequestIdMiddleware(config.logger) as express.RequestHandler);

  app.get(HEALTH_ENDPOINT_PATH, (_req, res) => {
    const result: ApiResponse = {
      data: { status: "ok", uptime: process.uptime() },
      error: null,
    };
    res.json(result);
  });

  return app;
};

const mountRouterAndErrorHandlers = (
  app: Application,
  config: InternalConfig,
): void => {
  const router = Router();
  registerRoutes(router, config.routes);
  app.use(config.apiPrefix, router);

  app.use((_req, res) => {
    const result: ApiResponse = { data: null, error: "Not found" };
    res.status(HTTP_STATUS_CODES.NOT_FOUND).json(result);
  });

  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      config.logger.error("Unhandled server error", {
        error: { message: err.message, name: err.name, stack: err.stack },
      });
      const result: ApiResponse = {
        data: null,
        error: "Internal server error",
      };
      res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(result);
    },
  );
};

class ApiServer {
  static #instance: ApiServer | null = null;

  #app: Application;
  #server: HttpServer | null;
  #config: InternalConfig;
  #signalCleanup: SignalCleanup | null;

  private constructor(app: Application, config: InternalConfig) {
    this.#app = app;
    this.#server = null;
    this.#config = config;
    this.#signalCleanup = null;
  }

  static create = (input: ApiServerConfig): ApiServer => {
    const config = buildInternalConfig(input);
    const app = buildExpressApp(config);

    const instance = new ApiServer(app, config);

    ApiServer.#instance = instance;

    return instance;
  };

  static getInstance = (): ApiServer => {
    const isNotInitialized = ApiServer.#instance === null;

    if (isNotInitialized) {
      throw new Error(
        "ApiServer not initialized. Call ApiServer.create() first.",
      );
    }

    return ApiServer.#instance!;
  };

  get expressApp(): Application {
    return this.#app;
  }

  get port(): number {
    const addr = this.#server?.address();
    const resolvedPort =
      typeof addr === "object" && addr !== null ? addr.port : this.#config.port;

    return resolvedPort;
  }

  start = async (): Promise<void> => {
    mountRouterAndErrorHandlers(this.#app, this.#config);

    await this.#config.onAppStart?.();

    await new Promise<void>((resolve) => {
      const server = this.#app.listen(this.#config.port, () => {
        this.#server = server;
        this.#config.logger.info(
          `ApiServer listening on port ${this.port}`,
        );
        resolve();
      });
    });

    this.#signalCleanup = setupSignals({
      server: this.#server!,
      logger: this.#config.logger,
      onAppStop: this.#config.onAppStop,
    });
  };

  stop = async (): Promise<void> => {
    const isSingleton = ApiServer.#instance === this;
    if (isSingleton) {
      ApiServer.#instance = null;
    }

    this.#signalCleanup?.();
    this.#signalCleanup = null;

    await this.#config.onAppStop?.();

    const server = this.#server;
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
      this.#server = null;
    }

    this.#config.logger.info("ApiServer stopped");
  };
}

export { ApiServer };
