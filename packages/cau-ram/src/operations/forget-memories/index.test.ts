import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";

import { RedisAgentMemory } from "../../redis-agent-memory";
import { MessageRole } from "../../constants";

import type { ForgetOptions } from "../../types";

const HAS_ENV = !!(process.env.RAM_ENDPOINT && process.env.RAM_API_KEY && process.env.RAM_STORE_ID);
const RATE_LIMIT_DELAY_MS = 3000;
const INDEX_DELAY_MS = 5000;
const OWNER_ID = "forget-test-user";
const NAMESPACE = "forget-test";

describe.skipIf(!HAS_ENV)("forgetMemories", () => {
  let ram: RedisAgentMemory;

  beforeAll(() => {
    ram = RedisAgentMemory.create();
  });

  afterEach(async () => {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS));
  });

  afterAll(() => {
    RedisAgentMemory.resetInstance();
  });

  it("should forget session only", async () => {
    const sessionId = `forget-session-only-${Date.now()}`;

    await ram.addSessionEvent({
      sessionId,
      actorId: OWNER_ID,
      role: MessageRole.USER,
      content: "This session will be forgotten.",
    });

    const result = await ram.forgetMemories({
      includeSession: true,
      includeLtm: false,
      session: { sessionId },
    });

    expect(result.deletedSessionIds).toContain(sessionId);
    expect(result.deletedLtmIds).toHaveLength(0);
    expect(result.totalDeleted).toBe(1);

    const session = await ram.getSessionMemory(sessionId);
    expect(session).toBeNull();
  });

  it("should forget LTM only by ownerId and namespace", async () => {
    const ownerId = `${OWNER_ID}-ltm-${Date.now()}`;

    const created = await ram.createLongTermMemories([
      { text: "Memory to forget about coffee preference.", ownerId, namespace: NAMESPACE },
      { text: "Memory to forget about tea preference.", ownerId, namespace: NAMESPACE },
    ]);

    await new Promise((r) => setTimeout(r, INDEX_DELAY_MS));

    const result = await ram.forgetMemories({
      includeSession: false,
      includeLtm: true,
      ltm: { ownerId, namespace: NAMESPACE },
    });

    expect(result.deletedSessionIds).toHaveLength(0);
    expect(result.deletedLtmIds.length).toBeGreaterThanOrEqual(2);
    expect(result.totalDeleted).toBeGreaterThanOrEqual(2);

    expect(result.deletedLtmIds).toContain(created.created[0]);
    expect(result.deletedLtmIds).toContain(created.created[1]);
  });

  it("should forget both session and LTM", async () => {
    const sessionId = `forget-both-${Date.now()}`;
    const ownerId = `${OWNER_ID}-both-${Date.now()}`;

    await ram.addSessionEvent({
      sessionId,
      actorId: ownerId,
      role: MessageRole.USER,
      content: "Session and LTM will be forgotten.",
    });

    await ram.createLongTermMemories([
      { text: "LTM linked to session that will be forgotten.", ownerId, namespace: NAMESPACE, sessionId },
    ]);

    await new Promise((r) => setTimeout(r, INDEX_DELAY_MS));

    const result = await ram.forgetMemories({
      includeSession: true,
      includeLtm: true,
      session: { sessionId },
      ltm: { ownerId, namespace: NAMESPACE },
    });

    expect(result.deletedSessionIds).toContain(sessionId);
    expect(result.deletedLtmIds.length).toBeGreaterThanOrEqual(1);
    expect(result.totalDeleted).toBeGreaterThanOrEqual(2);

    const session = await ram.getSessionMemory(sessionId);
    expect(session).toBeNull();
  });

  it("should forget LTM by semantic text search", async () => {
    const ownerId = `${OWNER_ID}-semantic-${Date.now()}`;

    await ram.createLongTermMemories([
      { text: "User's credit card number is 4111-1111-1111-1111.", ownerId, namespace: NAMESPACE },
    ]);

    await new Promise((r) => setTimeout(r, INDEX_DELAY_MS));

    const result = await ram.forgetMemories({
      includeSession: false,
      includeLtm: true,
      ltm: { text: "credit card number", ownerId, namespace: NAMESPACE },
    });

    expect(result.deletedLtmIds.length).toBeGreaterThanOrEqual(1);
    expect(result.totalDeleted).toBeGreaterThanOrEqual(1);
  });

  it("should throw when includeSession=true but session options missing", async () => {
    await expect(
      ram.forgetMemories({ includeSession: true, includeLtm: false }),
    ).rejects.toThrow("session.sessionId");
  });

  it("should throw when includeLtm=true but ltm options missing", async () => {
    await expect(
      ram.forgetMemories({ includeSession: false, includeLtm: true }),
    ).rejects.toThrow("at least one criterion");

    await expect(
      ram.forgetMemories({ includeSession: false, includeLtm: true, ltm: {} }),
    ).rejects.toThrow("at least one criterion");
  });

  it("should return empty result when no LTMs match", async () => {
    const result = await ram.forgetMemories({
      includeSession: false,
      includeLtm: true,
      ltm: { ownerId: `nonexistent-owner-${Date.now()}`, namespace: "nonexistent-ns" },
    });

    expect(result.deletedSessionIds).toHaveLength(0);
    expect(result.deletedLtmIds).toHaveLength(0);
    expect(result.totalDeleted).toBe(0);
  });
});
