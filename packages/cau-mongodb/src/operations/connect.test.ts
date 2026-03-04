import type { MongoDbState } from "../types";

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Logger } from "cau-logger";

import { connect, close, isConnected, ensureConnected } from "./connect";
import { ENV } from "../config";

const logger = Logger.create({
  context: "connect-test",
  transports: [{ type: "console" }],
});

const buildState = (): MongoDbState => ({
  client: null,
  db: null,
  logger,
  config: {
    uri: ENV.MONGODB_URI,
    database: ENV.MONGODB_DATABASE,
  },
});

describe("connection lifecycle", () => {
  let state: MongoDbState;

  beforeAll(() => {
    state = buildState();
  });

  afterAll(async () => {
    await close(state);
  });

  it("should report not connected before connect is called", () => {
    expect(isConnected(state)).toBe(false);
  });

  it("should connect to MongoDB", async () => {
    await connect(state);
    expect(isConnected(state)).toBe(true);
    expect(state.client).not.toBeNull();
    expect(state.db).not.toBeNull();
  });

  it("should be idempotent -- calling connect twice does not error", async () => {
    await connect(state);
    expect(isConnected(state)).toBe(true);
  });

  it("should close the connection", async () => {
    await close(state);
    expect(isConnected(state)).toBe(false);
    expect(state.client).toBeNull();
    expect(state.db).toBeNull();
  });

  it("should be idempotent -- calling close twice does not error", async () => {
    await close(state);
    expect(isConnected(state)).toBe(false);
  });
});

describe("ensureConnected", () => {
  let state: MongoDbState;

  afterEach(async () => {
    await close(state);
  });

  it("should lazily connect when not already connected", async () => {
    state = buildState();
    expect(isConnected(state)).toBe(false);
    await ensureConnected(state);
    expect(isConnected(state)).toBe(true);
  });

  it("should not reconnect if already connected", async () => {
    state = buildState();
    await connect(state);
    const clientRef = state.client;
    await ensureConnected(state);
    expect(state.client).toBe(clientRef);
  });
});
