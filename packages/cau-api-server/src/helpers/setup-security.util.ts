import type { Application, SecurityOptions } from "../types";

import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import {
  DEFAULT_BODY_LIMIT,
  DEFAULT_RATE_LIMIT_MAX,
  DEFAULT_RATE_LIMIT_WINDOW_MS,
} from "../constants";

const buildCorsOptions = (
  allowedOrigins: string[],
): cors.CorsOptions => {
  const options: cors.CorsOptions =
    allowedOrigins.length > 0
      ? { origin: allowedOrigins, credentials: true }
      : { origin: true, credentials: true };

  return options;
};

const setupSecurity = (
  app: Application,
  options?: Partial<SecurityOptions>,
): void => {
  const {
    allowedOrigins = [],
    bodyLimit = DEFAULT_BODY_LIMIT,
    rateLimitWindowMs = DEFAULT_RATE_LIMIT_WINDOW_MS,
    rateLimitMax = DEFAULT_RATE_LIMIT_MAX,
  } = options ?? {};

  app.use(helmet());
  app.use(cors(buildCorsOptions(allowedOrigins)));
  app.use(compression());
  app.use(express.json({ limit: bodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: bodyLimit }));
  app.use(
    rateLimit({
      windowMs: rateLimitWindowMs,
      max: rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
};

export { setupSecurity };
