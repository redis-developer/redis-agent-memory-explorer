import { describe, it, expect, afterEach } from "vitest";

import { ENV } from "./config";
import { AgentMemory } from "./agent-memory";

describe("AgentMemory", () => {
  afterEach(async () => {
    try {
      const instance = AgentMemory.getInstance();
      await instance.close();
    } catch {
      // already closed
    }
  });

  it("should create an instance and check health", async () => {
    const mem = AgentMemory.create({
      baseUrl: ENV.AGENT_MEMORY_BASE_URL,
    });

    const health = await mem.healthCheck();

    expect(typeof health.now).toBe("number");
    expect(health.now).toBeGreaterThan(0);
  });

  it("should return same instance via getInstance", () => {
    const mem = AgentMemory.create({
      baseUrl: ENV.AGENT_MEMORY_BASE_URL,
    });
    const same = AgentMemory.getInstance();

    expect(same).toBe(mem);
  });

  it("should clear singleton on close", async () => {
    const mem = AgentMemory.create({
      baseUrl: ENV.AGENT_MEMORY_BASE_URL,
    });
    await mem.close();

    const throwsFn = () => AgentMemory.getInstance();

    expect(throwsFn).toThrow("AgentMemory not initialized");
  });

  it("should throw when getInstance called before create", () => {
    const throwsFn = () => AgentMemory.getInstance();

    expect(throwsFn).toThrow("AgentMemory not initialized");
  });
});
