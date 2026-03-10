import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MemoryAPIClient } from "agent-memory-client";

import { ENV } from "../config";
import { SummaryViewSource } from "../constants";
import {
  createSummaryViewOp,
  listSummaryViewsOp,
  getSummaryViewOp,
  deleteSummaryViewOp,
  getTaskOp,
} from "./summary-view";

describe("summary-view operations", () => {
  let client: MemoryAPIClient;
  let createdViewId: string | null = null;

  beforeAll(() => {
    client = new MemoryAPIClient({
      baseUrl: ENV.AGENT_MEMORY_BASE_URL,
    });
  });

  afterAll(async () => {
    const hasView = createdViewId !== null;
    if (hasView) {
      await deleteSummaryViewOp(client, createdViewId!).catch(() => {});
    }
  });

  it("should create a summary view", async () => {
    const result = await createSummaryViewOp(client, {
      name: `test-view-${Date.now()}`,
      source: SummaryViewSource.LONG_TERM,
      groupBy: ["user_id"],
    });

    expect(result.id).toBeDefined();
    expect(result.source).toBe(SummaryViewSource.LONG_TERM);
    expect(result.groupBy).toEqual(["user_id"]);
    createdViewId = result.id;
  });

  it("should list summary views including created one", async () => {
    const result = await listSummaryViewsOp(client);

    expect(Array.isArray(result)).toBe(true);

    const found = result.some((v) => v.id === createdViewId);
    expect(found).toBe(true);
  });

  it("should get a summary view by ID", async () => {
    const result = await getSummaryViewOp(client, createdViewId!);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(createdViewId);
  });

  it("should delete a summary view", async () => {
    const result = await deleteSummaryViewOp(client, createdViewId!);

    expect(result.status).toBeDefined();

    const verifyGone = await getSummaryViewOp(client, createdViewId!);
    expect(verifyGone).toBeNull();

    createdViewId = null;
  });

  it("should return null for non-existent task", async () => {
    const result = await getTaskOp(client, "nonexistent-task-id");

    expect(result).toBeNull();
  });
});
