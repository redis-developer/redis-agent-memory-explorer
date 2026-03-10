import type { MemoryRecordInput } from "../types";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MemoryAPIClient } from "agent-memory-client";

import { ENV } from "../config";
import { MemoryType } from "../constants";
import {
  createLongTermMemoriesOp,
  searchLongTermMemoryOp,
  getLongTermMemoryOp,
  editLongTermMemoryOp,
  deleteLongTermMemoriesOp,
} from "./long-term-memory";

const TEST_NAMESPACE = `test-ltm-${Date.now()}`;
const createdMemoryIds: string[] = [];

describe("long-term-memory operations", () => {
  let client: MemoryAPIClient;

  beforeAll(() => {
    client = new MemoryAPIClient({
      baseUrl: ENV.AGENT_MEMORY_BASE_URL,
    });
  });

  afterAll(async () => {
    const hasIds = createdMemoryIds.length > 0;
    if (hasIds) {
      await deleteLongTermMemoriesOp(client, createdMemoryIds).catch(() => {});
    }
  });

  it("should create long-term memories", async () => {
    const memories: MemoryRecordInput[] = [
      {
        text: `Test memory alpha ${TEST_NAMESPACE}`,
        memoryType: MemoryType.SEMANTIC,
        topics: ["testing"],
        namespace: TEST_NAMESPACE,
      },
      {
        text: `Test memory beta ${TEST_NAMESPACE}`,
        memoryType: MemoryType.SEMANTIC,
        topics: ["testing"],
        namespace: TEST_NAMESPACE,
      },
    ];

    const result = await createLongTermMemoriesOp(client, memories);

    expect(result.status).toBeDefined();
  });

  it("should search and find created memories", async () => {
    // Allow indexing time
    await new Promise((r) => setTimeout(r, 2000));

    const result = await searchLongTermMemoryOp(client, {
      text: `Test memory alpha ${TEST_NAMESPACE}`,
      namespace: { eq: TEST_NAMESPACE },
      limit: 10,
    });

    expect(result.memories.length).toBeGreaterThanOrEqual(1);
    expect(result.total).toBeGreaterThanOrEqual(1);

    const ids = result.memories.map((m) => m.id);
    createdMemoryIds.push(...ids);
  });

  it("should get a long-term memory by ID", async () => {
    const hasIds = createdMemoryIds.length > 0;
    expect(hasIds).toBe(true);

    const memoryId = createdMemoryIds[0];
    const result = await getLongTermMemoryOp(client, memoryId);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(memoryId);
    expect(result!.text).toContain("Test memory");
  });

  it("should edit a long-term memory", async () => {
    const memoryId = createdMemoryIds[0];
    const updatedText = `Edited memory ${TEST_NAMESPACE}`;

    const result = await editLongTermMemoryOp(client, memoryId, {
      text: updatedText,
    });

    expect(result.id).toBe(memoryId);
    expect(result.text).toBe(updatedText);
  });

  it("should delete long-term memories", async () => {
    const result = await deleteLongTermMemoriesOp(client, createdMemoryIds);

    expect(result.status).toBeDefined();

    const verifyGone = await getLongTermMemoryOp(
      client,
      createdMemoryIds[0],
    );
    expect(verifyGone).toBeNull();

    createdMemoryIds.length = 0;
  });
});
