import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";

import { RedisAgentMemory } from "../../redis-agent-memory";
import { MessageRole } from "../../constants";

const HAS_ENV = !!(process.env.RAM_ENDPOINT && process.env.RAM_API_KEY && process.env.RAM_STORE_ID);
const TEST_SESSION_PREFIX = "test-session-";
const RATE_LIMIT_DELAY_MS = 3000;

const generateTestSessionId = (): string => {
  return `${TEST_SESSION_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

describe.skipIf(!HAS_ENV)("session memory operations", () => {
  let ram: RedisAgentMemory;
  const sessionsToCleanup: string[] = [];

  beforeAll(() => {
    ram = RedisAgentMemory.create();
  });

  afterEach(async () => {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS));
  });

  afterAll(async () => {
    for (const sessionId of sessionsToCleanup) {
      try {
        await ram.deleteSessionMemory(sessionId);
      } catch {
        // ignore cleanup errors
      }
    }
    RedisAgentMemory.resetInstance();
  });

  it("should connect and pass health check", async () => {
    const result = await ram.health();

    expect(result).toBeDefined();
    expect(result.status).toBeDefined();
  });

  it("should add event and retrieve session", async () => {
    const sessionId = generateTestSessionId();
    sessionsToCleanup.push(sessionId);

    const event = await ram.addSessionEvent({
      sessionId,
      actorId: "user-1",
      role: MessageRole.USER,
      content: "Hello, this is a test message.",
    });

    expect(event).toBeDefined();
    expect(event.eventId).toBeDefined();
    expect(event.sessionId).toBe(sessionId);
    expect(event.actorId).toBe("user-1");
    expect(event.role).toBe(MessageRole.USER);
    expect(event.content).toBe("Hello, this is a test message.");
    expect(event.createdAt).toBeGreaterThan(0);

    const session = await ram.getSessionMemory(sessionId);

    expect(session).not.toBeNull();
    expect(session!.sessionId).toBe(sessionId);
    expect(session!.ownerId).toBe("user-1");
    expect(session!.events).toHaveLength(1);
    expect(session!.events[0].content).toBe("Hello, this is a test message.");
  });

  it("should add multiple events and retrieve in order", async () => {
    const sessionId = generateTestSessionId();
    sessionsToCleanup.push(sessionId);

    await ram.addSessionEvent({
      sessionId,
      actorId: "user-1",
      role: MessageRole.USER,
      content: "What is Redis?",
    });

    await ram.addSessionEvent({
      sessionId,
      actorId: "assistant-1",
      role: MessageRole.ASSISTANT,
      content: "Redis is an in-memory data store.",
    });

    await ram.addSessionEvent({
      sessionId,
      actorId: "user-1",
      role: MessageRole.USER,
      content: "Tell me more.",
    });

    const session = await ram.getSessionMemory(sessionId);

    expect(session).not.toBeNull();
    expect(session!.events).toHaveLength(3);
    expect(session!.events[0].content).toBe("What is Redis?");
    expect(session!.events[1].content).toBe("Redis is an in-memory data store.");
    expect(session!.events[2].content).toBe("Tell me more.");
    expect(session!.events[0].role).toBe(MessageRole.USER);
    expect(session!.events[1].role).toBe(MessageRole.ASSISTANT);
  });

  it("should list sessions after creation", async () => {
    const sessionId = generateTestSessionId();
    sessionsToCleanup.push(sessionId);

    await ram.addSessionEvent({
      sessionId,
      actorId: "user-1",
      role: MessageRole.USER,
      content: "Session for listing test.",
    });

    const result = await ram.listSessions({ limit: 100 });

    expect(result).toBeDefined();
    expect(result.sessions).toBeInstanceOf(Array);
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.sessions).toContain(sessionId);
  });

  it("should delete session", async () => {
    const sessionId = generateTestSessionId();

    await ram.addSessionEvent({
      sessionId,
      actorId: "user-1",
      role: MessageRole.USER,
      content: "This will be deleted.",
    });

    await ram.deleteSessionMemory(sessionId);

    const session = await ram.getSessionMemory(sessionId);

    expect(session).toBeNull();
  });

  it("should handle non-existent session gracefully", async () => {
    const fakeSessionId = `nonexistent-${Date.now()}`;

    const session = await ram.getSessionMemory(fakeSessionId);

    expect(session).toBeNull();
  });

  it("should support metadata on events", async () => {
    const sessionId = generateTestSessionId();
    sessionsToCleanup.push(sessionId);

    const event = await ram.addSessionEvent({
      sessionId,
      actorId: "user-1",
      role: MessageRole.USER,
      content: "Message with metadata",
      metadata: { source: "test", priority: 1 },
    });

    expect(event.metadata).toBeDefined();

    const session = await ram.getSessionMemory(sessionId);

    expect(session!.events[0].metadata).toBeDefined();
  });

  it("should get a single session event by ID", async () => {
    const sessionId = generateTestSessionId();
    sessionsToCleanup.push(sessionId);

    const created = await ram.addSessionEvent({
      sessionId,
      actorId: "user-1",
      role: MessageRole.USER,
      content: "Fetch me by event ID.",
    });

    const fetched = await ram.getSessionEvent(sessionId, created.eventId);

    expect(fetched).toBeDefined();
    expect(fetched.eventId).toBe(created.eventId);
    expect(fetched.sessionId).toBe(sessionId);
    expect(fetched.actorId).toBe("user-1");
    expect(fetched.content).toBe("Fetch me by event ID.");
  });

  it("should delete a single session event by ID", async () => {
    const sessionId = generateTestSessionId();
    sessionsToCleanup.push(sessionId);

    const event1 = await ram.addSessionEvent({
      sessionId,
      actorId: "user-1",
      role: MessageRole.USER,
      content: "First message stays.",
    });

    const event2 = await ram.addSessionEvent({
      sessionId,
      actorId: "user-1",
      role: MessageRole.USER,
      content: "Second message gets deleted.",
    });

    await ram.deleteSessionEvent(sessionId, event2.eventId);

    const session = await ram.getSessionMemory(sessionId);

    expect(session).not.toBeNull();
    expect(session!.events).toHaveLength(1);
    expect(session!.events[0].eventId).toBe(event1.eventId);
    expect(session!.events[0].content).toBe("First message stays.");
  });
});
