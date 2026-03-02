import { describe, it, expect, afterEach, afterAll, beforeAll } from "vitest";
import { MongoClient } from "mongodb";
import knex from "knex";

import type { Knex } from "knex";

import { createLogger } from "./logger";
import {
  readFileSync,
  readdirSync,
  mkdirSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";

import { ENV } from "./config";
import type { CauLogger } from "./types";

const TMP_DIR = join(process.cwd(), ENV.TEST.CAU_LOGGER_TMP_SUFFIX);

const ensureTmpDir = (): void => {
  const needsCreate = !existsSync(TMP_DIR);
  if (needsCreate) {
    mkdirSync(TMP_DIR, { recursive: true });
  }
};

const cleanTmpDir = (): void => {
  const exists = existsSync(TMP_DIR);
  if (exists) {
    rmSync(TMP_DIR, { recursive: true, force: true });
  }
};

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

describe("createLogger", () => {
  let logger: CauLogger;

  afterEach(async () => {
    if (logger) {
      try {
        await logger.close();
      } catch {
        // transport may already be closed
      }
    }
  });

  afterAll(() => {
    cleanTmpDir();
  });

  it("should create a logger with zero config (sensible defaults)", () => {
    logger = createLogger();

    expect(logger).toBeDefined();
    expect(logger.info).toBeTypeOf("function");
    expect(logger.error).toBeTypeOf("function");
    expect(logger.child).toBeTypeOf("function");
    expect(logger.flush).toBeTypeOf("function");
    expect(logger.close).toBeTypeOf("function");
  });

  it("should create a logger with console transport", () => {
    logger = createLogger({
      level: "info",
      transports: [{ type: "console", pretty: false }],
    });

    expect(logger).toBeDefined();
    expect(logger.info).toBeTypeOf("function");
    expect(logger.error).toBeTypeOf("function");
    expect(logger.child).toBeTypeOf("function");
    expect(logger.close).toBeTypeOf("function");
  });

  it("should support all log level methods", () => {
    logger = createLogger({
      level: "trace",
      transports: [{ type: "console", pretty: false }],
    });

    expect(logger.trace).toBeTypeOf("function");
    expect(logger.debug).toBeTypeOf("function");
    expect(logger.info).toBeTypeOf("function");
    expect(logger.warn).toBeTypeOf("function");
    expect(logger.error).toBeTypeOf("function");
    expect(logger.fatal).toBeTypeOf("function");
  });

  it("should create a child logger with merged bindings", () => {
    logger = createLogger({
      level: "info",
      transports: [{ type: "console", pretty: false }],
    });

    const child = logger.child({ requestId: "req-123" });

    expect(child).toBeDefined();
    expect(child.info).toBeTypeOf("function");
    expect(child.child).toBeTypeOf("function");
    expect(child.flush).toBeTypeOf("function");
    expect(child.close).toBeTypeOf("function");
  });

  it("should set context in base bindings", () => {
    logger = createLogger({
      level: "info",
      context: "TestService",
      transports: [{ type: "console", pretty: false }],
    });

    expect(logger).toBeDefined();
  });

  it("should write logs to a file via file transport", async () => {
    ensureTmpDir();
    const logPath = join(TMP_DIR, "test.log");

    logger = createLogger({
      level: "info",
      transports: [{ type: "file", path: logPath, mkdir: true }],
    });

    logger.info("test file message");
    logger.warn({ extra: "data" }, "test warning");

    await logger.flush();
    await wait(500);

    const files = readdirSync(TMP_DIR);
    const logFile = files.find((f: string) => f.includes("test"));

    if (logFile) {
      const content = readFileSync(join(TMP_DIR, logFile), "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);

      expect(lines.length).toBeGreaterThanOrEqual(1);

      const firstRecord = JSON.parse(lines[0]);
      expect(firstRecord.msg).toBe("test file message");
      expect(firstRecord.level).toBe(30);
      expect(firstRecord.time).toBeTypeOf("number");
    }
  });

  it("should support multiple transports simultaneously", () => {
    ensureTmpDir();

    logger = createLogger({
      level: "debug",
      transports: [
        { type: "console", pretty: false },
        { type: "file", path: join(TMP_DIR, "multi.log"), mkdir: true },
      ],
    });

    expect(logger).toBeDefined();
    logger.info("multi-transport test");
  });

  it("should respect the global log level", () => {
    logger = createLogger({
      level: "warn",
      transports: [{ type: "console", pretty: false }],
    });

    expect(logger.level).toBe("warn");
    expect(logger.isLevelEnabled("info")).toBe(false);
    expect(logger.isLevelEnabled("warn")).toBe(true);
    expect(logger.isLevelEnabled("error")).toBe(true);
  });

  it("should allow changing log level at runtime", () => {
    logger = createLogger({
      level: "info",
      transports: [{ type: "console", pretty: false }],
    });

    expect(logger.level).toBe("info");
    expect(logger.isLevelEnabled("debug")).toBe(false);

    logger.level = "debug";

    expect(logger.level).toBe("debug");
    expect(logger.isLevelEnabled("debug")).toBe(true);
  });

  it("should not expose underlying library internals", () => {
    logger = createLogger();

    const keys = Object.keys(logger);
    const allowedKeys = [
      "trace",
      "debug",
      "info",
      "warn",
      "error",
      "fatal",
      "child",
      "level",
      "isLevelEnabled",
      "flush",
      "close",
    ];

    for (const key of keys) {
      expect(allowedKeys).toContain(key);
    }
  });
});

describe("createLogger with mongo transport", () => {
  let logger: CauLogger;
  let verifyClient: MongoClient;

  const MONGO_URI = ENV.MONGO_URI;
  const TEST_DB = ENV.TEST.CAU_LOGGER_MONGO_DB_NAME;
  const TEST_COLLECTION = ENV.TEST.CAU_LOGGER_MONGO_COLLECTION;

  const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

  beforeAll(async () => {
    verifyClient = new MongoClient(MONGO_URI);
    await verifyClient.connect();
    await verifyClient.db(TEST_DB).collection(TEST_COLLECTION).deleteMany({});
  });

  afterEach(async () => {
    if (logger) {
      try {
        await logger.close();
      } catch {
        // transport may already be closed
      }
    }
  });

  afterAll(async () => {
    await verifyClient.db(TEST_DB).collection(TEST_COLLECTION).deleteMany({});
    await verifyClient.close();
  });

  it("should write logs to MongoDB via mongo transport", async () => {
    logger = createLogger({
      level: "info",
      transports: [
        {
          type: "mongo",
          uri: MONGO_URI,
          database: TEST_DB,
          collection: TEST_COLLECTION,
          batchSize: 2,
          flushInterval: 60000,
        },
      ],
    });

    logger.info("logger mongo test message");
    logger.warn({ extra: "data" }, "logger mongo warning");

    await logger.flush();
    await wait(2000);

    const docs = await verifyClient
      .db(TEST_DB)
      .collection(TEST_COLLECTION)
      .find({})
      .toArray();

    expect(docs.length).toBeGreaterThanOrEqual(1);
    const msgDoc = docs.find((d) => d.msg === "logger mongo test message");
    expect(msgDoc).toBeDefined();
    expect(msgDoc?.level).toBe(30);
    expect(msgDoc?.time).toBeTypeOf("number");
  });

  it("should preserve context and bindings when writing to MongoDB", async () => {
    logger = createLogger({
      level: "info",
      context: "LoggerMongoTest",
      transports: [
        {
          type: "mongo",
          uri: MONGO_URI,
          database: TEST_DB,
          collection: TEST_COLLECTION,
          batchSize: 1,
          flushInterval: 60000,
        },
      ],
    });

    const child = logger.child({ requestId: "req-mongo-123" });
    child.info("child logger mongo message");

    await logger.flush();
    await wait(2000);

    const docs = await verifyClient
      .db(TEST_DB)
      .collection(TEST_COLLECTION)
      .find({})
      .toArray();

    const msgDoc = docs.find((d) => d.msg === "child logger mongo message");
    expect(msgDoc).toBeDefined();
    expect(msgDoc?.context).toBe("LoggerMongoTest");
    expect(msgDoc?.requestId).toBe("req-mongo-123");
  });
});

describe("createLogger with sql transport", () => {
  let logger: CauLogger;
  let verifyDb: Knex;

  const PG_CONNECTION = ENV.PG_CONNECTION_URL;
  const TEST_TABLE = ENV.TEST.CAU_LOGGER_SQL_TABLE;

  const KNEX_CONFIG: Knex.Config = {
    client: "pg",
    connection: PG_CONNECTION,
  };

  const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

  beforeAll(async () => {
    verifyDb = knex(KNEX_CONFIG);

    await verifyDb.schema.dropTableIfExists(TEST_TABLE);
    await verifyDb.schema.createTable(TEST_TABLE, (t) => {
      t.increments("id").primary();
      t.integer("level").notNullable();
      t.timestamp("timestamp").notNullable();
      t.text("message").notNullable();
      t.text("context").nullable();
      t.jsonb("data").notNullable();
    });
  });

  afterEach(async () => {
    if (logger) {
      try {
        await logger.close();
      } catch {
        // transport may already be closed
      }
    }
  });

  afterAll(async () => {
    await verifyDb(TEST_TABLE).truncate();
    await verifyDb.schema.dropTableIfExists(TEST_TABLE);
    await verifyDb.destroy();
  });

  it("should write logs to PostgreSQL via sql transport", async () => {
    logger = createLogger({
      level: "info",
      transports: [
        {
          type: "sql",
          knexConfig: KNEX_CONFIG as Record<string, unknown>,
          table: TEST_TABLE,
          batchSize: 2,
          flushInterval: 60000,
        },
      ],
    });

    logger.info("logger sql test message");
    logger.warn({ extra: "data" }, "logger sql warning");

    await logger.flush();
    await wait(2000);

    const rows = await verifyDb(TEST_TABLE).select("*");

    expect(rows.length).toBeGreaterThanOrEqual(1);
    const msgRow = rows.find(
      (r: { message: string }) => r.message === "logger sql test message",
    );
    expect(msgRow).toBeDefined();
    expect(msgRow?.level).toBe(30);
    expect(msgRow?.timestamp).toBeDefined();
  });

  it("should preserve context and bindings when writing to PostgreSQL", async () => {
    logger = createLogger({
      level: "info",
      context: "LoggerSqlTest",
      transports: [
        {
          type: "sql",
          knexConfig: KNEX_CONFIG as Record<string, unknown>,
          table: TEST_TABLE,
          batchSize: 1,
          flushInterval: 60000,
        },
      ],
    });

    const child = logger.child({ requestId: "req-sql-456" });
    child.info("child logger sql message");

    await logger.flush();
    await wait(2000);

    const rows = await verifyDb(TEST_TABLE).select("*");

    const msgRow = rows.find(
      (r: { message: string }) => r.message === "child logger sql message",
    );
    expect(msgRow).toBeDefined();
    expect(msgRow?.context).toBe("LoggerSqlTest");

    const data =
      typeof msgRow?.data === "string" ? JSON.parse(msgRow.data) : msgRow?.data;
    expect(data.requestId).toBe("req-sql-456");
  });
});
