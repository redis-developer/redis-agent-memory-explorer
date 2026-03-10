import type { Application, Request, Response, NextFunction } from "express";
import type { Server as HttpServer } from "node:http";
import type { Logger } from "cau-logger";

type ServerConfig = {
  PORT?: number;
  API_PREFIX?: string;
  ALLOWED_ORIGINS?: string[];
  BODY_LIMIT?: string;
  RATE_LIMIT_WINDOW_MS?: number;
  RATE_LIMIT_MAX?: number;
};

type RouteContext = {
  logger: Logger;
  requestId: string;
};

type RouteHandler = (
  input: unknown,
  context: RouteContext,
) => Promise<unknown> | unknown;

type RouteDefinition = {
  path: string;
  handler: RouteHandler;
};

type LifecycleCallback = () => Promise<void> | void;

type ApiServerConfig = {
  config?: ServerConfig;
  logger?: Logger;
  onAppStart?: LifecycleCallback;
  onAppStop?: LifecycleCallback;
  routes: RouteDefinition[];
};

type ApiResponse<T = unknown> = {
  data: T | null;
  error: string | null;
};

type InternalConfig = {
  port: number;
  apiPrefix: string;
  allowedOrigins: string[];
  bodyLimit: string;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  logger: Logger;
  onAppStart?: LifecycleCallback;
  onAppStop?: LifecycleCallback;
  routes: RouteDefinition[];
};

type ExpressMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void;

type AugmentedRequest = Request & {
  requestId: string;
  logger: Logger;
};

type SecurityOptions = {
  allowedOrigins: string[];
  bodyLimit: string;
  rateLimitWindowMs: number;
  rateLimitMax: number;
};

type SignalHandlerDeps = {
  server: HttpServer;
  logger: Logger;
  onAppStop?: LifecycleCallback;
};

type SignalCleanup = () => void;

export type {
  ServerConfig,
  RouteContext,
  RouteHandler,
  RouteDefinition,
  LifecycleCallback,
  ApiServerConfig,
  ApiResponse,
  InternalConfig,
  ExpressMiddleware,
  AugmentedRequest,
  Application,
  HttpServer,
  SecurityOptions,
  SignalHandlerDeps,
  SignalCleanup,
};
