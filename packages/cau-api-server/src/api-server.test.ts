import { describe, it, expect, afterEach } from "vitest";

import { Logger } from "cau-logger";

import { ApiServer } from "./api-server";
import { HTTP_STATUS_CODES, HEALTH_ENDPOINT_PATH } from "./constants";

describe("ApiServer", () => {
  let instance: ApiServer | null = null;

  const createLogger = (context: string): Logger =>
    Logger.create({ context, transports: [{ type: "console" }] });

  afterEach(async () => {
    if (instance) {
      await instance.stop();
      instance = null;
    }
    ApiServer.reset();
  });

  it("should create an ApiServer instance with expressApp accessible", () => {
    instance = ApiServer.create({
      logger: createLogger("test-create"),
      routes: [{ path: "/ping", handler: async () => ({ pong: true }) }],
    });

    expect(instance).toBeDefined();
    expect(instance.expressApp).toBeDefined();
  });

  it("should serve the built-in GET /health endpoint", async () => {
    instance = ApiServer.create({
      config: { PORT: 0 },
      logger: createLogger("test-health"),
      routes: [],
    });
    await instance.start();

    const baseUrl = `http://localhost:${instance.port}`;
    const res = await fetch(`${baseUrl}${HEALTH_ENDPOINT_PATH}`);
    const body = await res.json();

    expect(res.status).toBe(HTTP_STATUS_CODES.OK);
    expect(body.data.status).toBe("ok");
    expect(typeof body.data.uptime).toBe("number");
    expect(body.error).toBeNull();
  });

  it("should serve POST routes under API_PREFIX and return { data, error } envelope", async () => {
    const responseData = { users: ["alice", "bob"] };
    instance = ApiServer.create({
      config: { PORT: 0, API_PREFIX: "/api" },
      logger: createLogger("test-routes"),
      routes: [{ path: "/users", handler: async () => responseData }],
    });
    await instance.start();

    const baseUrl = `http://localhost:${instance.port}`;
    const res = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const body = await res.json();

    expect(res.status).toBe(HTTP_STATUS_CODES.OK);
    expect(body.data).toEqual(responseData);
    expect(body.error).toBeNull();
  });

  it("should pass input and RouteContext to handlers", async () => {
    const inputPayload = { filter: "active" };
    let capturedInput: unknown;
    let capturedRequestId: string | undefined;

    instance = ApiServer.create({
      config: { PORT: 0 },
      logger: createLogger("test-context"),
      routes: [
        {
          path: "/echo",
          handler: async (input, context) => {
            capturedInput = input;
            capturedRequestId = context.requestId;
            return { echoed: true };
          },
        },
      ],
    });
    await instance.start();

    const baseUrl = `http://localhost:${instance.port}`;
    await fetch(`${baseUrl}/api/echo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inputPayload),
    });

    expect(capturedInput).toEqual(inputPayload);
    expect(capturedRequestId).toBeDefined();
    expect(capturedRequestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("should catch handler errors and return 500 with error message", async () => {
    const errorMsg = "handler blew up";
    instance = ApiServer.create({
      config: { PORT: 0 },
      logger: createLogger("test-error"),
      routes: [
        {
          path: "/fail",
          handler: async () => {
            throw new Error(errorMsg);
          },
        },
      ],
    });
    await instance.start();

    const baseUrl = `http://localhost:${instance.port}`;
    const res = await fetch(`${baseUrl}/api/fail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const body = await res.json();

    expect(res.status).toBe(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
    expect(body.data).toBeNull();
    expect(body.error).toBe(errorMsg);
  });

  it("should return 404 for unknown routes", async () => {
    instance = ApiServer.create({
      config: { PORT: 0 },
      logger: createLogger("test-404"),
      routes: [],
    });
    await instance.start();

    const baseUrl = `http://localhost:${instance.port}`;
    const res = await fetch(`${baseUrl}/api/nonexistent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const body = await res.json();

    expect(res.status).toBe(HTTP_STATUS_CODES.NOT_FOUND);
    expect(body.data).toBeNull();
    expect(body.error).toBe("Not found");
  });

  it("should call onAppStart during start", async () => {
    let startCalled = false;
    instance = ApiServer.create({
      config: { PORT: 0 },
      logger: createLogger("test-onAppStart"),
      onAppStart: async () => {
        startCalled = true;
      },
      routes: [],
    });
    await instance.start();

    expect(startCalled).toBe(true);
  });

  it("should call onAppStop during stop", async () => {
    let stopCalled = false;
    instance = ApiServer.create({
      config: { PORT: 0 },
      logger: createLogger("test-onAppStop"),
      onAppStop: async () => {
        stopCalled = true;
      },
      routes: [],
    });
    await instance.start();
    await instance.stop();
    instance = null;

    expect(stopCalled).toBe(true);
  });

  it("should return the same instance from getInstance (singleton)", () => {
    const first = ApiServer.getInstance({
      logger: createLogger("test-singleton"),
      routes: [],
    });
    const second = ApiServer.getInstance();

    expect(first).toBe(second);
    instance = first;
  });

  it("should create a default logger when none provided", () => {
    instance = ApiServer.create({
      routes: [{ path: "/ping", handler: async () => ({ pong: true }) }],
    });

    expect(instance).toBeDefined();
    expect(instance.expressApp).toBeDefined();
  });

  it("should include X-Request-Id header in responses", async () => {
    instance = ApiServer.create({
      config: { PORT: 0 },
      logger: createLogger("test-request-id"),
      routes: [{ path: "/ping", handler: async () => ({ pong: true }) }],
    });
    await instance.start();

    const baseUrl = `http://localhost:${instance.port}`;
    const res = await fetch(`${baseUrl}/api/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const requestId = res.headers.get("x-request-id");

    expect(requestId).toBeDefined();
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});
