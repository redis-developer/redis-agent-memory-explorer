import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";

import { LangCache } from "./lang-cache";

const hasCredentials = (): boolean => {
  return Boolean(process.env.LANGCACHE_SERVER_URL && process.env.LANGCACHE_CACHE_ID);
};

// This cache enforces an attribute schema: attributes may only be `feature`,
// `userId`, or `namespace`. We partition this test run via a unique `namespace`
// so entries never collide with real data and can be bulk-deleted afterwards.
const RUN_NS = `cau-langcache-test-${Date.now()}`;
const FEATURE = "chatbot";
const THRESHOLD = 0.9;

const attrs = (extra?: Record<string, string>): Record<string, string> => ({
  feature: FEATURE,
  namespace: RUN_NS,
  ...extra,
});

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

describe("LangCache singleton lifecycle", () => {
  afterEach(() => {
    LangCache.resetInstance();
  });

  it("throws when getInstance is called before create", () => {
    expect(() => LangCache.getInstance()).toThrow("LangCache not initialized");
  });

  it("returns the same instance after create", () => {
    LangCache.create({ serverURL: "https://example.com", cacheId: "x", apiKey: "y" });

    const first = LangCache.getInstance();
    const second = LangCache.getInstance();
    expect(first).toBe(second);
  });

  it("throws on getInstance after resetInstance", () => {
    LangCache.create({ serverURL: "https://example.com", cacheId: "x", apiKey: "y" });
    LangCache.resetInstance();

    expect(() => LangCache.getInstance()).toThrow("LangCache not initialized");
  });
});

describe.runIf(hasCredentials())("LangCache real execution", () => {
  let cache: LangCache;

  beforeAll(() => {
    cache = LangCache.create();
  });

  afterAll(async () => {
    try {
      await cache.deleteByAttributes({ namespace: RUN_NS });
    } catch {
      // best-effort cleanup
    }
    LangCache.resetInstance();
  });

  it("1. set then search the same prompt returns a hit above threshold", async () => {
    const prompt = `What happened in the Feb 26 2026 meeting? (${RUN_NS})`;
    const response = "We discussed the bond ladder and REIT concerns.";

    const entryId = await cache.set({
      prompt,
      response,
      attributes: attrs({ userId: "user-a" }),
    });
    expect(entryId).toBeTruthy();

    const hit = await cache.search({
      prompt,
      similarityThreshold: THRESHOLD,
      attributes: attrs({ userId: "user-a" }),
    });

    expect(hit).not.toBeNull();
    expect(hit!.response).toBe(response);
    expect(hit!.similarity).toBeGreaterThanOrEqual(THRESHOLD);
  });

  it("2. search an unrelated prompt at a high threshold returns null", async () => {
    const hit = await cache.search({
      prompt: `Completely unrelated quantum chromodynamics query ${RUN_NS}`,
      similarityThreshold: 0.99,
      attributes: attrs({ userId: "user-a" }),
    });

    expect(hit).toBeNull();
  });

  it("3. attribute isolation: stored for user-a, searched as user-b returns null", async () => {
    const prompt = `What are James's financial goals? (${RUN_NS})`;

    await cache.set({
      prompt,
      response: "Retire at 60 with a stable income.",
      attributes: attrs({ userId: "user-a" }),
    });

    const hit = await cache.search({
      prompt,
      similarityThreshold: THRESHOLD,
      attributes: attrs({ userId: "user-b" }),
    });

    expect(hit).toBeNull();
  });

  it("4. deleteByAttributes drops entries so a later search misses", async () => {
    const prompt = `What did James decide about bonds? (${RUN_NS})`;
    const delAttrs = attrs({ userId: "user-delete" });

    await cache.set({ prompt, response: "Hold bonds to maturity.", attributes: delAttrs });

    const before = await cache.search({ prompt, similarityThreshold: THRESHOLD, attributes: delAttrs });
    expect(before).not.toBeNull();

    const deleted = await cache.deleteByAttributes(delAttrs);
    expect(deleted).toBeGreaterThanOrEqual(1);

    const after = await cache.search({ prompt, similarityThreshold: THRESHOLD, attributes: delAttrs });
    expect(after).toBeNull();
  });

  it("5. entries with a small ttlMillis expire", async () => {
    const prompt = `Short lived question ${RUN_NS}`;
    const ttlAttrs = attrs({ userId: "user-ttl" });

    await cache.set({ prompt, response: "ephemeral", attributes: ttlAttrs, ttlMillis: 2000 });

    let expired = false;
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      await sleep(3000);
      const hit = await cache.search({ prompt, similarityThreshold: THRESHOLD, attributes: ttlAttrs });
      if (hit === null) {
        expired = true;
        break;
      }
    }

    expect(expired).toBe(true);
  });

  it("6. health returns true for a reachable cache", async () => {
    const healthy = await cache.health();
    expect(healthy).toBe(true);
  });
});
