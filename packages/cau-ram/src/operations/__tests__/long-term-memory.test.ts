import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";

import { RedisAgentMemory } from "../../redis-agent-memory";
import { MemoryType } from "../../constants";

const HAS_ENV = !!(process.env.RAM_ENDPOINT && process.env.RAM_API_KEY && process.env.RAM_STORE_ID);
const TEST_NAMESPACE = "test-ltm";
const RATE_LIMIT_DELAY_MS = 3000;
const INDEX_DELAY_MS = 5000;

describe.skipIf(!HAS_ENV)("long-term memory operations", () => {
  let ram: RedisAgentMemory;
  const memoryIdsToCleanup: string[] = [];

  beforeAll(async () => {
    ram = RedisAgentMemory.create();

    const seed = await ram.createLongTermMemories([
      { text: "Seed record to ensure search index exists.", namespace: TEST_NAMESPACE, ownerId: "seed-user" },
    ]);
    memoryIdsToCleanup.push(...seed.created);

    const maxWait = 30_000;
    const start = Date.now();
    let indexReady = false;

    while (Date.now() - start < maxWait) {
      try {
        await ram.searchLongTermMemory({ text: "seed", filter: { namespace: TEST_NAMESPACE } });
        indexReady = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    if (!indexReady) {
      console.warn("Search index not ready after 30s -- tests may fail.");
    }
  }, 60_000);

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

    await new Promise((r) => setTimeout(r, INDEX_DELAY_MS));

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

    await new Promise((r) => setTimeout(r, INDEX_DELAY_MS));

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

    await new Promise((r) => setTimeout(r, INDEX_DELAY_MS));

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

  it("should return nextPageToken when more results exist", async () => {
    const ownerId = `test-user-pagetoken-${Date.now()}`;
    const records = Array.from({ length: 4 }, (_, i) => ({
      text: `Page token probe record ${i + 1} about testing.`,
      namespace: TEST_NAMESPACE,
      topics: ["pagetoken-test"],
      ownerId,
    }));

    const createResult = await ram.createLongTermMemories(records);
    memoryIdsToCleanup.push(...createResult.created);

    await new Promise((r) => setTimeout(r, INDEX_DELAY_MS));

    const page1 = await ram.searchLongTermMemory({
      filter: { ownerId, namespace: TEST_NAMESPACE },
      limit: 2,
    });

    expect(page1.memories.length).toBe(2);
    expect(page1.nextPageToken).toBeDefined();

    const page2 = await ram.searchLongTermMemory({
      filter: { ownerId, namespace: TEST_NAMESPACE },
      limit: 2,
      pageToken: page1.nextPageToken,
    });

    expect(page2.memories.length).toBe(2);

    const allIds = [...page1.memories.map((m) => m.id), ...page2.memories.map((m) => m.id)];
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(4);
  });

  it("should use filterOp 'all' for AND logic across filters", async () => {
    const ownerId = `test-user-filterop-all-${Date.now()}`;

    const createResult = await ram.createLongTermMemories([
      {
        text: "Record with both topics: frontend and react.",
        namespace: TEST_NAMESPACE,
        topics: ["frontend", "react"],
        ownerId,
      },
      {
        text: "Record with only frontend topic.",
        namespace: TEST_NAMESPACE,
        topics: ["frontend"],
        ownerId,
      },
    ]);
    memoryIdsToCleanup.push(...createResult.created);

    await new Promise((r) => setTimeout(r, INDEX_DELAY_MS));

    const result = await ram.searchLongTermMemory({
      filter: { ownerId, namespace: TEST_NAMESPACE, topics: ["frontend", "react"] },
      filterOp: "all",
      limit: 10,
    });

    expect(result.memories.length).toBeGreaterThanOrEqual(1);
    const matchedTexts = result.memories.map((m) => m.text);
    expect(matchedTexts.some((t) => t.includes("both topics"))).toBe(true);
  });

  it("should use filterOp 'any' for OR logic across filters", async () => {
    const ownerId = `test-user-filterop-any-${Date.now()}`;

    const createResult = await ram.createLongTermMemories([
      {
        text: "Record about backend development in Node.",
        namespace: TEST_NAMESPACE,
        topics: ["backend"],
        ownerId,
        sessionId: "session-a",
      },
      {
        text: "Record about frontend development in React.",
        namespace: TEST_NAMESPACE,
        topics: ["frontend"],
        ownerId,
        sessionId: "session-b",
      },
    ]);
    memoryIdsToCleanup.push(...createResult.created);

    await new Promise((r) => setTimeout(r, INDEX_DELAY_MS));

    const resultAll = await ram.searchLongTermMemory({
      filter: { ownerId, sessionId: "session-a", namespace: TEST_NAMESPACE },
      filterOp: "all",
      limit: 10,
    });

    expect(resultAll.memories.length).toBeGreaterThanOrEqual(1);
    expect(resultAll.memories.every((m) => m.sessionId === "session-a")).toBe(true);

    const resultAny = await ram.searchLongTermMemory({
      filter: { ownerId, sessionId: "session-a", namespace: TEST_NAMESPACE },
      filterOp: "any",
      limit: 10,
    });

    expect(resultAny.memories.length).toBeGreaterThanOrEqual(2);
  });

  it("should throw when search has no text and no filter", async () => {
    await expect(ram.searchLongTermMemory({})).rejects.toThrow(
      "searchLongTermMemory requires at least one of 'text' or 'filter'.",
    );

    await expect(ram.searchLongTermMemory({ limit: 10 })).rejects.toThrow(
      "searchLongTermMemory requires at least one of 'text' or 'filter'.",
    );
  });

  it("should throw when searchAll has no text and no filter", async () => {
    await expect(ram.searchAllLongTermMemory({})).rejects.toThrow(
      "searchAllLongTermMemory requires at least one of 'text' or 'filter'.",
    );
  });

  it("should respect similarityThreshold in search", async () => {
    const ownerId = `test-user-threshold-${Date.now()}`;

    const createResult = await ram.createLongTermMemories([
      {
        text: "The capital of France is Paris, located on the Seine river.",
        namespace: TEST_NAMESPACE,
        ownerId,
      },
      {
        text: "Quantum computing uses qubits for parallel computation.",
        namespace: TEST_NAMESPACE,
        ownerId,
      },
    ]);
    memoryIdsToCleanup.push(...createResult.created);

    await new Promise((r) => setTimeout(r, INDEX_DELAY_MS));

    const highThreshold = await ram.searchLongTermMemory({
      text: "What is the capital of France?",
      filter: { ownerId, namespace: TEST_NAMESPACE },
      similarityThreshold: 0.8,
      limit: 10,
    });

    const lowThreshold = await ram.searchLongTermMemory({
      text: "What is the capital of France?",
      filter: { ownerId, namespace: TEST_NAMESPACE },
      similarityThreshold: 0.1,
      limit: 10,
    });

    expect(lowThreshold.memories.length).toBeGreaterThanOrEqual(highThreshold.memories.length);

    if (highThreshold.memories.length > 0) {
      expect(highThreshold.memories[0].text).toContain("France");
    }
  });

  it("should paginate fully with searchAllLongTermMemory", async () => {
    const ownerId = `test-user-searchall-${Date.now()}`;
    const records = Array.from({ length: 6 }, (_, i) => ({
      text: `Full pagination test item ${i + 1} for searchAll verification.`,
      namespace: TEST_NAMESPACE,
      topics: ["searchall-test"],
      ownerId,
    }));

    const createResult = await ram.createLongTermMemories(records);
    memoryIdsToCleanup.push(...createResult.created);

    await new Promise((r) => setTimeout(r, INDEX_DELAY_MS));

    const allResult = await ram.searchAllLongTermMemory({
      filter: { ownerId, namespace: TEST_NAMESPACE },
      limit: 2,
    });

    expect(allResult.memories.length).toBe(6);

    const uniqueIds = new Set(allResult.memories.map((m) => m.id));
    expect(uniqueIds.size).toBe(6);

    const uniqueTexts = new Set(allResult.memories.map((m) => m.text));
    expect(uniqueTexts.size).toBe(6);
  });
});
