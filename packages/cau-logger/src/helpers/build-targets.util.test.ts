import { describe, it, expect } from "vitest";

import { buildTargets, buildTarget } from "./build-targets.util";

import type { TransportConfig } from "../types";

describe("buildTarget", () => {
  describe("console transport", () => {
    it("should build a pino-pretty target when format is pretty", () => {
      const config: TransportConfig = { type: "console", format: "pretty" };
      const target = buildTarget(config);

      expect(target.target).toBe("pino-pretty");
      expect(target.options.colorize).toBe(true);
      expect(target.options.destination).toBe(1);
    });

    it("should build a pino/file target when format is json", () => {
      const config: TransportConfig = { type: "console", format: "json" };
      const target = buildTarget(config);

      expect(target.target).toBe("pino/file");
      expect(target.options.destination).toBe(1);
    });

    it("should use stderr when destination is stderr", () => {
      const config: TransportConfig = {
        type: "console",
        format: "pretty",
        destination: "stderr",
      };
      const target = buildTarget(config);

      expect(target.options.destination).toBe(2);
    });

    it("should pass through the level when specified", () => {
      const config: TransportConfig = {
        type: "console",
        format: "pretty",
        level: "warn",
      };
      const target = buildTarget(config);

      expect(target.level).toBe("warn");
    });

    it("should respect colorize override", () => {
      const config: TransportConfig = {
        type: "console",
        format: "pretty",
        colorize: false,
      };
      const target = buildTarget(config);

      expect(target.options.colorize).toBe(false);
    });
  });

  describe("file transport", () => {
    it("should build a pino-roll target with defaults", () => {
      const config: TransportConfig = { type: "file", path: "./logs/app.log" };
      const target = buildTarget(config);

      expect(target.target).toBe("pino-roll");
      expect(target.options.file).toBe("./logs/app.log");
      expect(target.options.frequency).toBe("daily");
      expect(target.options.mkdir).toBe(true);
    });

    it("should pass maxSize and maxFiles as pino-roll options", () => {
      const config: TransportConfig = {
        type: "file",
        path: "./logs/app.log",
        maxSize: "10m",
        maxFiles: 5,
      };
      const target = buildTarget(config);

      expect(target.options.size).toBe("10m");
      expect(target.options.limit).toEqual({ count: 5 });
    });

    it("should allow hourly rotation", () => {
      const config: TransportConfig = {
        type: "file",
        path: "./logs/app.log",
        rotation: "hourly",
      };
      const target = buildTarget(config);

      expect(target.options.frequency).toBe("hourly");
    });
  });

  describe("mongo transport", () => {
    it("should build a target pointing to the compiled mongo transport", () => {
      const config: TransportConfig = {
        type: "mongo",
        uri: "mongodb://localhost:27017",
        database: "testdb",
      };
      const target = buildTarget(config);

      expect(target.target).toMatch(/[/\\]transports[/\\]mongo\.transport\.js$/);
      expect(target.options.uri).toBe("mongodb://localhost:27017");
      expect(target.options.database).toBe("testdb");
      expect(target.options.collection).toBe("logs");
      expect(target.options.batchSize).toBe(100);
      expect(target.options.flushInterval).toBe(5000);
    });

    it("should allow overriding collection, batchSize, and flushInterval", () => {
      const config: TransportConfig = {
        type: "mongo",
        uri: "mongodb://localhost:27017",
        database: "testdb",
        collection: "audit_logs",
        batchSize: 50,
        flushInterval: 1000,
      };
      const target = buildTarget(config);

      expect(target.options.collection).toBe("audit_logs");
      expect(target.options.batchSize).toBe(50);
      expect(target.options.flushInterval).toBe(1000);
    });
  });

  describe("sql transport", () => {
    it("should build a target pointing to the compiled sql transport", () => {
      const config: TransportConfig = {
        type: "sql",
        connection: { client: "pg", connection: "postgres://localhost/test" },
      };
      const target = buildTarget(config);

      expect(target.target).toMatch(/[/\\]transports[/\\]sql\.transport\.js$/);
      expect(target.options.knexConfig).toEqual({
        client: "pg",
        connection: "postgres://localhost/test",
      });
      expect(target.options.table).toBe("logs");
      expect(target.options.batchSize).toBe(100);
      expect(target.options.flushInterval).toBe(5000);
    });
  });
});

describe("buildTargets", () => {
  it("should map an array of transport configs to pino targets", () => {
    const configs: TransportConfig[] = [
      { type: "console", format: "pretty" },
      { type: "file", path: "./logs/app.log" },
    ];
    const targets = buildTargets(configs);

    expect(targets).toHaveLength(2);
    expect(targets[0].target).toBe("pino-pretty");
    expect(targets[1].target).toBe("pino-roll");
  });
});
