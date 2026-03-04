import { describe, it, expect, afterAll } from "vitest";
import type { Server } from "node:http";

import express from "express";
import { Logger } from "cau-logger";

import { createRequestIdMiddleware } from "./request-id.util";
import { REQUEST_ID_HEADER } from "../constants";

describe("createRequestIdMiddleware", () => {
  let server: Server;

  afterAll(() => {
    server?.close();
  });

  it("should set X-Request-Id response header with a UUID", async () => {
    const logger = Logger.create({
      context: "test-request-id",
      transports: [{ type: "console" }],
    });
    const app = express();
    app.use(createRequestIdMiddleware(logger) as express.RequestHandler);
    app.get("/test", (_req, res) => {
      res.json({ ok: true });
    });
    server = app.listen(0);
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const baseUrl = `http://localhost:${port}`;

    const res = await fetch(`${baseUrl}/test`);
    const requestId = res.headers.get(REQUEST_ID_HEADER.toLowerCase());

    expect(requestId).toBeDefined();
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    await logger.close();
  });

  it("should generate unique request ids across requests", async () => {
    const logger = Logger.create({
      context: "test-request-id-unique",
      transports: [{ type: "console" }],
    });
    const app = express();
    app.use(createRequestIdMiddleware(logger) as express.RequestHandler);
    app.get("/test", (_req, res) => {
      res.json({ ok: true });
    });
    const srv = app.listen(0);
    const address = srv.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const baseUrl = `http://localhost:${port}`;

    const res1 = await fetch(`${baseUrl}/test`);
    const res2 = await fetch(`${baseUrl}/test`);

    const id1 = res1.headers.get(REQUEST_ID_HEADER.toLowerCase());
    const id2 = res2.headers.get(REQUEST_ID_HEADER.toLowerCase());

    expect(id1).not.toBe(id2);
    srv.close();
    await logger.close();
  });

  it("should attach requestId and logger to the request object", async () => {
    const logger = Logger.create({
      context: "test-request-id-attach",
      transports: [{ type: "console" }],
    });
    const app = express();
    app.use(createRequestIdMiddleware(logger) as express.RequestHandler);

    let capturedRequestId: string | undefined;
    let capturedLoggerExists = false;

    app.get("/test", (req: any, res) => {
      capturedRequestId = req.requestId;
      capturedLoggerExists = typeof req.logger?.info === "function";
      res.json({ ok: true });
    });
    const srv = app.listen(0);
    const address = srv.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const baseUrl = `http://localhost:${port}`;

    await fetch(`${baseUrl}/test`);

    expect(capturedRequestId).toBeDefined();
    expect(capturedRequestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(capturedLoggerExists).toBe(true);
    srv.close();
    await logger.close();
  });
});
