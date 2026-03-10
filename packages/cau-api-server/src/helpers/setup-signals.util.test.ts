import { describe, it, expect, afterAll } from "vitest";
import type { Server } from "node:http";

import http from "node:http";
import { Logger } from "cau-logger";

import { gracefulShutdown } from "./setup-signals.util";

describe("gracefulShutdown", () => {
  let server: Server;

  afterAll(() => {
    server?.close();
  });

  it("should call onAppStop callback and close the server", async () => {
    let onAppStopCalled = false;

    server = http.createServer((_req, res) => {
      res.end("ok");
    });
    server.listen(0);

    const logger = Logger.create({
      context: "test-signals",
      transports: [{ type: "console" }],
    });

    const originalExit = process.exit;
    let exitCalled = false;
    let exitCode: number | undefined;
    process.exit = ((code?: number) => {
      exitCalled = true;
      exitCode = code;
    }) as never;

    await gracefulShutdown("TEST_SIGNAL", {
      server,
      logger,
      onAppStop: async () => {
        onAppStopCalled = true;
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(onAppStopCalled).toBe(true);
    expect(exitCalled).toBe(true);
    expect(exitCode).toBe(0);

    process.exit = originalExit;
    await logger.close();
  });
});
