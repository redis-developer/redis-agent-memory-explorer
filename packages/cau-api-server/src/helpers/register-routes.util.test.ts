import { describe, it, expect, afterAll } from "vitest";
import type { Server } from "node:http";

import express from "express";
import { Logger } from "cau-logger";

import { registerRoutes } from "./register-routes.util";
import { createRequestIdMiddleware } from "./request-id.util";

describe("registerRoutes", () => {
  const servers: Server[] = [];

  afterAll(() => {
    for (const srv of servers) {
      srv.close();
    }
  });

  const createTestServer = (
    routes: Parameters<typeof registerRoutes>[1],
  ): { baseUrl: string; server: Server; logger: Logger } => {
    const logger = Logger.create({
      context: "test-register-routes",
      transports: [{ type: "console" }],
    });
    const app = express();
    app.use(express.json());
    app.use(createRequestIdMiddleware(logger) as express.RequestHandler);

    const router = express.Router();
    registerRoutes(router, routes);
    app.use("/api", router);

    const server = app.listen(0);
    servers.push(server);
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const baseUrl = `http://localhost:${port}`;

    return { baseUrl, server, logger };
  };

  it("should register POST routes and return { data, error } envelope", async () => {
    const responsePayload = { users: ["alice", "bob"] };
    const { baseUrl, logger } = createTestServer([
      {
        path: "/users",
        handler: async () => responsePayload,
      },
    ]);

    const res = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual(responsePayload);
    expect(body.error).toBeNull();
    await logger.close();
  });

  it("should pass request body as input to the handler", async () => {
    const inputPayload = { filter: "active" };
    let capturedInput: unknown;

    const { baseUrl, logger } = createTestServer([
      {
        path: "/echo",
        handler: async (input) => {
          capturedInput = input;
          return { echoed: true };
        },
      },
    ]);

    await fetch(`${baseUrl}/api/echo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inputPayload),
    });

    expect(capturedInput).toEqual(inputPayload);
    await logger.close();
  });

  it("should pass RouteContext with logger and requestId to handler", async () => {
    let capturedRequestId: string | undefined;
    let capturedLoggerExists = false;

    const { baseUrl, logger } = createTestServer([
      {
        path: "/context-check",
        handler: async (_input, context) => {
          capturedRequestId = context.requestId;
          capturedLoggerExists = typeof context.logger?.info === "function";
          return { ok: true };
        },
      },
    ]);

    await fetch(`${baseUrl}/api/context-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(capturedRequestId).toBeDefined();
    expect(capturedRequestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(capturedLoggerExists).toBe(true);
    await logger.close();
  });

  it("should catch handler errors and return { data: null, error: message }", async () => {
    const errorMsg = "handler exploded";
    const { baseUrl, logger } = createTestServer([
      {
        path: "/fail",
        handler: async () => {
          throw new Error(errorMsg);
        },
      },
    ]);

    const res = await fetch(`${baseUrl}/api/fail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.data).toBeNull();
    expect(body.error).toBe(errorMsg);
    await logger.close();
  });

  it("should return proper error message, not [object Object]", async () => {
    const errorMsg = "serialization test error";
    const { baseUrl, logger } = createTestServer([
      {
        path: "/error-msg",
        handler: async () => {
          throw new Error(errorMsg);
        },
      },
    ]);

    const res = await fetch(`${baseUrl}/api/error-msg`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const body = await res.json();

    expect(body.error).toBe(errorMsg);
    expect(body.error).not.toBe("[object Object]");
    await logger.close();
  });
});
