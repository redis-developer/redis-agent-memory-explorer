import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MemoryAPIClient } from "agent-memory-client";

import { ENV } from "../config";
import { putWorkingMemoryOp, deleteWorkingMemoryOp } from "./working-memory";
import { memoryPromptOp } from "./memory-prompt";

const TEST_NAMESPACE = `test-mp-${Date.now()}`;
const TEST_SESSION_ID = `mp-session-${Date.now()}`;

describe("memory-prompt operations", () => {
  let client: MemoryAPIClient;

  beforeAll(async () => {
    client = new MemoryAPIClient({
      baseUrl: ENV.AGENT_MEMORY_BASE_URL,
    });

    await putWorkingMemoryOp(
      client,
      TEST_SESSION_ID,
      {
        messages: [
          { role: "user", content: "I love Italian food" },
          { role: "assistant", content: "Italian food is delicious!" },
        ],
        namespace: TEST_NAMESPACE,
      },
      { namespace: TEST_NAMESPACE },
    );
  });

  afterAll(async () => {
    await deleteWorkingMemoryOp(client, TEST_SESSION_ID, {
      namespace: TEST_NAMESPACE,
    }).catch(() => {});
  });

  it("should return memory-enhanced prompt messages", async () => {
    const result = await memoryPromptOp(client, {
      query: "What food do I like?",
      session: {
        sessionId: TEST_SESSION_ID,
      },
    });

    expect(result.messages).toBeDefined();
    expect(Array.isArray(result.messages)).toBe(true);
    expect(result.messages.length).toBeGreaterThanOrEqual(1);

    const hasRoles = result.messages.every(
      (msg) => typeof msg.role === "string",
    );
    expect(hasRoles).toBe(true);
  });
});
