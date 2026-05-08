import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";

import { RedisAgentMemory } from "../../redis-agent-memory";
import { MessageRole } from "../../constants";

import type { BuildMemoryPromptOptions } from "../../types";

const HAS_ENV = !!(process.env.RAM_ENDPOINT && process.env.RAM_API_KEY && process.env.RAM_STORE_ID);
const HAS_LLM = !!(process.env.OPENAI_API_KEY && process.env.SUMMARY_MODEL);

const SESSION_ID = "bmp-test-session";
const OWNER_ID = "bmp-test-user";
const RATE_LIMIT_DELAY_MS = 3000;

describe.skipIf(!HAS_ENV)("buildMemoryPrompt", () => {
  let ram: RedisAgentMemory;
  const memoryIdsToCleanup: string[] = [];

  beforeAll(async () => {
    ram = RedisAgentMemory.create();

    try {
      await ram.deleteSessionMemory(SESSION_ID);
    } catch { /* session may not exist */ }

    await new Promise((r) => setTimeout(r, 2000));

    const messages = [
      { actorId: OWNER_ID, role: MessageRole.USER, content: "Hi, I'm working on a Node.js API project using Express." },
      { actorId: "assistant", role: MessageRole.ASSISTANT, content: "That's great! What kind of API are you building?" },
      { actorId: OWNER_ID, role: MessageRole.USER, content: "It's a REST API for managing bookmarks. Users can save URLs with tags." },
      { actorId: "assistant", role: MessageRole.ASSISTANT, content: "Nice! Do you want to use MongoDB or PostgreSQL for storage?" },
      { actorId: OWNER_ID, role: MessageRole.USER, content: "I prefer PostgreSQL with Prisma ORM." },
      { actorId: "assistant", role: MessageRole.ASSISTANT, content: "Good choice. Shall I help you set up the schema?" },
    ];

    for (const msg of messages) {
      await ram.addSessionEvent({
        sessionId: SESSION_ID,
        actorId: msg.actorId,
        role: msg.role,
        content: msg.content,
      });
      await new Promise((r) => setTimeout(r, 1500));
    }

    const ltmRecords = await ram.createLongTermMemories([
      {
        text: "User prefers PostgreSQL with Prisma ORM for database projects.",
        ownerId: OWNER_ID,
        namespace: "bmp-test",
        topics: ["database", "preferences"],
      },
      {
        text: "User is building a REST API for bookmark management using Express.",
        ownerId: OWNER_ID,
        namespace: "bmp-test",
        topics: ["project", "api"],
      },
    ]);
    memoryIdsToCleanup.push(...ltmRecords.created);

    await new Promise((r) => setTimeout(r, 5000));
  }, 120_000);

  afterEach(async () => {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS));
  });

  afterAll(async () => {
    try {
      await ram.deleteSessionMemory(SESSION_ID);
    } catch { /* ok */ }

    if (memoryIdsToCleanup.length > 0) {
      try {
        await ram.deleteLongTermMemories(memoryIdsToCleanup);
      } catch { /* ok */ }
    }
  }, 60_000);

  it("should build memory prompt with session only (no LTM search)", async () => {
    const result = await ram.buildMemoryPrompt({
      query: "How should I design the bookmark schema?",
      sessionId: SESSION_ID,
      longTermSearch: false,
    });

    expect(result.context).toBeTruthy();
    expect(result.recentSessionEvents.length).toBeGreaterThan(0);
    expect(result.longTermMemories).toHaveLength(0);
    expect(result.tokenUsage.budget).toBeGreaterThan(0);
    expect(result.tokenUsage.used).toBeGreaterThan(0);
    expect(result.tokenUsage.used).toBeLessThan(result.tokenUsage.budget);
  });

  it("should build memory prompt with LTM search (no session)", async () => {
    const result = await ram.buildMemoryPrompt({
      query: "What database does the user prefer?",
      ownerId: OWNER_ID,
      namespace: "bmp-test",
    });

    expect(result.context).toBeTruthy();
    expect(result.longTermMemories.length).toBeGreaterThan(0);
    expect(result.recentSessionEvents).toHaveLength(0);
    expect(result.context).toContain("Long-Term Memory");
  });

  it("should build memory prompt with both session and LTM", async () => {
    const result = await ram.buildMemoryPrompt({
      query: "What database and ORM should I use?",
      sessionId: SESSION_ID,
      ownerId: OWNER_ID,
      namespace: "bmp-test",
    });

    expect(result.context).toBeTruthy();
    expect(result.recentSessionEvents.length).toBeGreaterThan(0);
    expect(result.longTermMemories.length).toBeGreaterThan(0);
    expect(result.context).toContain("Long-Term Memory");
    expect(result.context).toContain("Recent Conversation");
  });

  it("should respect contextWindowMax by fitting content within budget", async () => {
    const result = await ram.buildMemoryPrompt({
      query: "Tell me about the project.",
      sessionId: SESSION_ID,
      contextWindowMax: 500,
      longTermSearch: false,
    });

    expect(result.tokenUsage.budget).toBe(500);
    expect(result.tokenUsage.used).toBeLessThanOrEqual(500);
  });

  it("should handle non-existent session gracefully", async () => {
    const result = await ram.buildMemoryPrompt({
      query: "Any context?",
      sessionId: "non-existent-session-xyz-12345",
      longTermSearch: false,
    });

    expect(result.recentSessionEvents).toHaveLength(0);
    expect(result.longTermMemories).toHaveLength(0);
    expect(result.sessionSummary).toBeUndefined();
  });

  it("should use custom longTermSearch options", async () => {
    const result = await ram.buildMemoryPrompt({
      query: "database preferences",
      longTermSearch: {
        text: "PostgreSQL Prisma",
        filter: { ownerId: OWNER_ID, namespace: "bmp-test" },
        limit: 5,
      },
    });

    expect(result.longTermMemories.length).toBeGreaterThan(0);
    const texts = result.longTermMemories.map((m) => m.text).join(" ");
    expect(texts.toLowerCase()).toContain("prisma");
  });

  it("should use modelName to determine budget when contextWindowMax is not set", async () => {
    const result = await ram.buildMemoryPrompt({
      query: "test",
      modelName: "gpt-4",
      longTermSearch: false,
    });

    expect(result.tokenUsage.budget).toBe(8192);
  });

  it.skipIf(!HAS_LLM)(
    "should summarize old messages when session exceeds a small context window",
    async () => {
      const result = await ram.buildMemoryPrompt({
        query: "What is this project about?",
        sessionId: SESSION_ID,
        contextWindowMax: 200,
        longTermSearch: false,
      });

      expect(result.tokenUsage.used).toBeLessThanOrEqual(200);
      if (result.sessionSummary) {
        expect(result.sessionSummary.length).toBeGreaterThan(0);
        expect(result.context).toContain("Session Summary");
      }
    },
    60_000,
  );
});
