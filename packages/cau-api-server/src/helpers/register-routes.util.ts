import type { Response, Router } from "express";
import type { AugmentedRequest, ApiResponse, RouteContext, RouteDefinition } from "../types";

import { HTTP_STATUS_CODES } from "../constants";
import { serializeError } from "./serialize-error.util";

const registerRoutes = (
  router: Router,
  routes: RouteDefinition[],
): void => {
  for (const route of routes) {
    router.post(route.path, async (req, res: Response) => {
      const result: ApiResponse = { data: null, error: null };
      const augReq = req as unknown as AugmentedRequest;
      const requestId = augReq.requestId;
      const reqLogger = augReq.logger;
      const context: RouteContext = { logger: reqLogger, requestId };

      try {
        result.data = await route.handler(req.body, context);
      } catch (err) {
        const errorDetail = serializeError(err);
        reqLogger.error(`${route.path} API failed`, {
          error: errorDetail,
        });
        result.error = errorDetail.message as string;
        res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
      }

      res.json(result);
    });
  }
};

export { registerRoutes };
