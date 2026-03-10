import type { WorkingMemoryOptions, RawClientConfig } from "../types";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MemoryAPIClient } from "agent-memory-client";

import { ENV } from "../config";
import {
  listSessionsOp,
  getWorkingMemoryOp,
  putWorkingMemoryOp,
  getOrCreateWorkingMemoryOp,
  deleteWorkingMemoryOp,
} from "./working-memory";

const TEST_NAMESPACE = `test-wm-${Date.now()}`;
const TEST_SESSION_ID = `wm-session-${Date.now()}`;

describe("working-memory operations", () => {
  let client: MemoryAPIClient;
  let rawConfig: RawClientConfig;
  const defaultOptions: WorkingMemoryOptions = {
    namespace: TEST_NAMESPACE,
  };

  beforeAll(() => {
    client = new MemoryAPIClient({
      baseUrl: ENV.AGENT_MEMORY_BASE_URL,
    });

    rawConfig = {
      baseUrl: ENV.AGENT_MEMORY_BASE_URL,
    };
  });

  afterAll(async () => {
    await deleteWorkingMemoryOp(client, TEST_SESSION_ID, {
      namespace: TEST_NAMESPACE,
    }).catch(() => {});
  });

  it("should return a session via getOrCreateWorkingMemory", async () => {
    const result = await getOrCreateWorkingMemoryOp(
      client,
      TEST_SESSION_ID,
      defaultOptions,
      rawConfig,
    );

    expect(result.created).toBe(true);
    expect(result.memory.sessionId).toBe(TEST_SESSION_ID);
  });

  it("should store messages via putWorkingMemory", async () => {
    const msg = "Hello from test";
    const result = await putWorkingMemoryOp(
      client,
      TEST_SESSION_ID,
      {
        messages: [{ role: "user", content: msg }],
      },
      defaultOptions,
    );

    expect(result.sessionId).toBe(TEST_SESSION_ID);
    expect(result.messages.length).toBeGreaterThanOrEqual(1);

    const lastMessage = result.messages[result.messages.length - 1];
    expect(lastMessage.content).toBe(msg);
    expect(lastMessage.role).toBe("user");
  });

  it("should retrieve stored working memory (without userId, same key)", async () => {
    const result = await getWorkingMemoryOp(
      client,
      TEST_SESSION_ID,
      defaultOptions,
    );

    expect(result).not.toBeNull();
    expect(result!.sessionId).toBe(TEST_SESSION_ID);
    expect(result!.messages.length).toBeGreaterThanOrEqual(1);
  });

  it("should retrieve stored working memory with userId via raw client", async () => {
    const userIdSessionId = `wm-uid-${Date.now()}`;

    await putWorkingMemoryOp(
      client,
      userIdSessionId,
      {
        messages: [{ role: "user", content: "user_id round-trip test" }],
        userId: "test-user",
      },
      { namespace: TEST_NAMESPACE },
    );

    const result = await getWorkingMemoryOp(
      client,
      userIdSessionId,
      { namespace: TEST_NAMESPACE, userId: "test-user" },
      rawConfig,
    );

    expect(result).not.toBeNull();
    expect(result!.sessionId).toBe(userIdSessionId);
    expect(result!.messages.length).toBeGreaterThanOrEqual(1);
    expect(result!.messages[0].content).toBe("user_id round-trip test");

    await deleteWorkingMemoryOp(
      client,
      userIdSessionId,
      { namespace: TEST_NAMESPACE, userId: "test-user" },
      rawConfig,
    );
  });

  it("should list sessions including the test session", async () => {
    const result = await listSessionsOp(client, {
      namespace: TEST_NAMESPACE,
    });

    expect(result.sessions).toContain(TEST_SESSION_ID);
    expect(result.total).toBeGreaterThanOrEqual(1);
  });

  it("should list sessions filtered by userId via raw client", async () => {
    const userId = `list-uid-${Date.now()}`;
    const sessionA = `list-a-${Date.now()}`;
    const sessionB = `list-b-${Date.now()}`;

    await putWorkingMemoryOp(
      client,
      sessionA,
      { messages: [{ role: "user", content: "session A" }], userId },
      { namespace: TEST_NAMESPACE },
    );
    await putWorkingMemoryOp(
      client,
      sessionB,
      { messages: [{ role: "user", content: "session B" }], userId },
      { namespace: TEST_NAMESPACE },
    );

    const result = await listSessionsOp(
      client,
      { namespace: TEST_NAMESPACE, userId },
      rawConfig,
    );

    expect(result.sessions).toContain(sessionA);
    expect(result.sessions).toContain(sessionB);
    expect(result.total).toBeGreaterThanOrEqual(2);

    await deleteWorkingMemoryOp(
      client,
      sessionA,
      { namespace: TEST_NAMESPACE, userId },
      rawConfig,
    ).catch(() => {});
    await deleteWorkingMemoryOp(
      client,
      sessionB,
      { namespace: TEST_NAMESPACE, userId },
      rawConfig,
    ).catch(() => {});
  });

  it("should getOrCreate with userId via raw client without duplicating", async () => {
    const userId = `goc-uid-${Date.now()}`;
    const sessionId = `goc-session-${Date.now()}`;
    const options: WorkingMemoryOptions = {
      namespace: TEST_NAMESPACE,
      userId,
    };

    const first = await getOrCreateWorkingMemoryOp(
      client,
      sessionId,
      options,
      rawConfig,
    );

    expect(first.created).toBe(true);
    expect(first.memory.sessionId).toBe(sessionId);

    const second = await getOrCreateWorkingMemoryOp(
      client,
      sessionId,
      options,
      rawConfig,
    );

    expect(second.created).toBe(false);
    expect(second.memory.sessionId).toBe(sessionId);

    await deleteWorkingMemoryOp(
      client,
      sessionId,
      { namespace: TEST_NAMESPACE, userId },
      rawConfig,
    ).catch(() => {});
  });

  it("should delete working memory for the session", async () => {
    const result = await deleteWorkingMemoryOp(client, TEST_SESSION_ID, {
      namespace: TEST_NAMESPACE,
    });

    expect(result.status).toBeDefined();
  });
});
