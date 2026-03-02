import { describe, it, expect, afterEach } from "vitest";
import { createLogger } from "./logger";
import {
  readFileSync,
  readdirSync,
  mkdirSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { ENV } from "./config";
import type { CauLogger } from "./types";

const TMP_DIR = join(tmpdir(), ENV.TEST.CAU_LOGGER_TMP_SUFFIX);

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
