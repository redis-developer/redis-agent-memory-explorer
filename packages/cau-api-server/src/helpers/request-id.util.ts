import type { Response, NextFunction } from "express";
import type { AugmentedRequest } from "../types";
import type { Logger } from "cau-logger";

import { randomUUID } from "node:crypto";

import { REQUEST_ID_HEADER } from "../constants";

const createRequestIdMiddleware = (
  logger: Logger,
) => {
  const middleware = (
    req: AugmentedRequest,
    res: Response,
    next: NextFunction,
  ): void => {
    const requestId = randomUUID();
    req.requestId = requestId;
    req.logger = logger.child({ requestId });
    res.setHeader(REQUEST_ID_HEADER, requestId);
    next();
  };

  return middleware;
};

export { createRequestIdMiddleware };
