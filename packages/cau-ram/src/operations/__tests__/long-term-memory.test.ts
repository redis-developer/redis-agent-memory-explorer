import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";

import { RedisAgentMemory } from "../../redis-agent-memory";
import { MemoryType } from "../../constants";

const HAS_ENV = !!(process.env.RAM_ENDPOINT && process.env.RAM_API_KEY && process.env.RAM_STORE_ID);
const TEST_NAMESPACE = "test-ltm";
const RATE_LIMIT_DELAY_MS = 3000;

describe.skipIf(!HAS_ENV)("long-term memory operations", () => {
  let ram: RedisAgentMemory;
  const memoryIdsToCleanup: string[] = [];

  beforeAll(() => {
    ram = RedisAgentMemory.create();
  });

  afterEach(async () => {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS));
  });

  afterAll(async () => {
    if (memoryIdsToCleanup.length > 0) {
      try {
        await ram.deleteLongTermMemories(memoryIdsToCleanup);
      } catch {
        // ignore cleanup errors
      }
    }
    RedisAgentMemory.resetInstance();
  });

  it("should create memories and return IDs", async () => {
    const result = await ram.createLongTermMemories([
      {
        text: "The user prefers dark mode interfaces.",
        namespace: TEST_NAMESPACE,
        topics: ["preferences", "ui"],
        memoryType: MemoryType.SEMANTIC,
        ownerId: "test-user-1",
      },
      {
        text: "The user works at a fintech company.",
        namespace: TEST_NAMESPACE,
        topics: ["work", "career"],
        memoryType: MemoryType.SEMANTIC,
        ownerId: "test-user-1",
      },
    ]);

    expect(result.created).toHaveLength(2);
    expect(result.created[0]).toBeDefined();
    expect(result.created[1]).toBeDefined();
    memoryIdsToCleanup.push(...result.created);
  });

  it("should search by text and find relevant memories", async () => {
    const createResult = await ram.createLongTermMemories([
      {
        text: "Redis supports vector similarity search for AI applications.",
        namespace: TEST_NAMESPACE,
        topics: ["redis", "vector-search"],
        ownerId: "test-user-2",
      },
    ]);
    memoryIdsToCleanup.push(...createResult.created);

    // Allow indexing time
    await new Promise((r) => setTimeout(r, 2000));

    const searchResult = await ram.searchLongTermMemory({
      text: "vector search in Redis",
      filter: { namespace: TEST_NAMESPACE, ownerId: "test-user-2" },
      limit: 5,
    });

    expect(searchResult.memories.length).toBeGreaterThanOrEqual(1);

    const found = searchResult.memories.find((m) => m.text.includes("vector similarity search"));
    expect(found).toBeDefined();
  });

  it("should search with filters", async () => {
    const createResult = await ram.createLongTermMemories([
      {
        text: "User enjoys hiking on weekends.",
        namespace: TEST_NAMESPACE,
        topics: ["hobbies"],
        ownerId: "test-user-filter",
        sessionId: "session-filter-test",
      },
      {
        text: "User likes reading sci-fi novels.",
        namespace: TEST_NAMESPACE,
        topics: ["hobbies", "reading"],
        ownerId: "test-user-filter",
      },
    ]);
    memoryIdsToCleanup.push(...createResult.created);

    await new Promise((r) => setTimeout(r, 2000));

    const byOwner = await ram.searchLongTermMemory({
      filter: { ownerId: "test-user-filter", namespace: TEST_NAMESPACE },
      limit: 10,
    });

    expect(byOwner.memories.length).toBeGreaterThanOrEqual(2);

    const bySession = await ram.searchLongTermMemory({
      filter: { sessionId: "session-filter-test", namespace: TEST_NAMESPACE },
      limit: 10,
    });

    expect(bySession.memories.length).toBeGreaterThanOrEqual(1);
    expect(bySession.memories[0].text).toContain("hiking");
  });

  it("should get single memory by ID", async () => {
    const createResult = await ram.createLongTermMemories([
      {
        text: "User speaks three languages: English, Spanish, French.",
        namespace: TEST_NAMESPACE,
        topics: ["languages"],
        ownerId: "test-user-get",
      },
    ]);
    memoryIdsToCleanup.push(...createResult.created);

    const memory = await ram.getLongTermMemory(createResult.created[0]);

    expect(memory.id).toBe(createResult.created[0]);
    expect(memory.text).toBe("User speaks three languages: English, Spanish, French.");
    expect(memory.namespace).toBe(TEST_NAMESPACE);
    expect(memory.ownerId).toBe("test-user-get");
    expect(memory.topics).toContain("languages");
    expect(memory.createdAt).toBeGreaterThan(0);
    expect(memory.updatedAt).toBeGreaterThan(0);
  });

  it("should update memory text and topics", async () => {
    const createResult = await ram.createLongTermMemories([
      {
        text: "Original memory text.",
        namespace: TEST_NAMESPACE,
        topics: ["original"],
        ownerId: "test-user-update",
      },
    ]);
    memoryIdsToCleanup.push(...createResult.created);

    const updated = await ram.updateLongTermMemory(createResult.created[0], {
      text: "Updated memory text.",
      topics: ["updated", "modified"],
    });

    expect(updated.id).toBe(createResult.created[0]);
    expect(updated.text).toBe("Updated memory text.");
    expect(updated.topics).toContain("updated");
    expect(updated.topics).toContain("modified");
    expect(updated.updatedAt).toBeGreaterThanOrEqual(updated.createdAt);
  });

  it("should delete memories by IDs", async () => {
    const createResult = await ram.createLongTermMemories([
      {
        text: "Memory to be deleted.",
        namespace: TEST_NAMESPACE,
        ownerId: "test-user-delete",
      },
    ]);

    const deleteResult = await ram.deleteLongTermMemories(createResult.created);

    expect(deleteResult.deleted).toContain(createResult.created[0]);

    try {
      await ram.getLongTermMemory(createResult.created[0]);
      expect.fail("Should have thrown for deleted memory");
    } catch (error: any) {
      expect(error).toBeDefined();
    }
  });

  it("should paginate with searchAll", async () => {
    const records = Array.from({ length: 5 }, (_, i) => ({
      text: `Pagination test memory number ${i + 1}.`,
      namespace: TEST_NAMESPACE,
      topics: ["pagination-test"],
      ownerId: "test-user-paginate",
    }));

    const createResult = await ram.createLongTermMemories(records);
    memoryIdsToCleanup.push(...createResult.created);

    await new Promise((r) => setTimeout(r, 2000));

    const allResult = await ram.searchAllLongTermMemory({
      filter: { ownerId: "test-user-paginate", namespace: TEST_NAMESPACE },
      limit: 2,
    });

    expect(allResult.memories.length).toBeGreaterThanOrEqual(5);
  });

  it("should support custom ID for idempotent creation", async () => {
    const customId = `custom-id-${Date.now()}`;

    const result1 = await ram.createLongTermMemories([
      {
        id: customId,
        text: "Memory with custom ID.",
        namespace: TEST_NAMESPACE,
        ownerId: "test-user-custom-id",
      },
    ]);
    memoryIdsToCleanup.push(customId);

    expect(result1.created).toContain(customId);

    const memory = await ram.getLongTermMemory(customId);
    expect(memory.id).toBe(customId);
    expect(memory.text).toBe("Memory with custom ID.");
  });
});
