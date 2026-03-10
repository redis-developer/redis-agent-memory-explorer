import type { MemoryRecordInput } from "../types";

import { describe, it, expect, beforeAll } from "vitest";
import { MemoryAPIClient } from "agent-memory-client";

import { ENV } from "../config";
import { MemoryType } from "../constants";
import {
  createLongTermMemoriesOp,
  deleteLongTermMemoriesOp,
} from "./long-term-memory";
import { forgetLongTermMemoriesOp } from "./forget";

const TEST_NAMESPACE = `test-forget-${Date.now()}`;

describe("forget operations", () => {
  let client: MemoryAPIClient;

  beforeAll(async () => {
    client = new MemoryAPIClient({
      baseUrl: ENV.AGENT_MEMORY_BASE_URL,
    });

    const memories: MemoryRecordInput[] = [
      {
        text: `Forget test memory ${TEST_NAMESPACE}`,
        memoryType: MemoryType.SEMANTIC,
        namespace: TEST_NAMESPACE,
      },
    ];

    await createLongTermMemoriesOp(client, memories);
    await new Promise((r) => setTimeout(r, 1000));
  });

  it("should run forget with dry run and return counts", async () => {
    const result = await forgetLongTermMemoriesOp(
      client,
      { maxAgeDays: 0 },
      {
        namespace: TEST_NAMESPACE,
        dryRun: true,
      },
    );

    expect(typeof result.deleted).toBe("number");
    expect(typeof result.scanned).toBe("number");
  });
});
