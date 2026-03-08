/**
 * Example 5: Background Extraction + Forget Flow
 *
 * Shows how conversations automatically create long-term memories via
 * background extraction (longTermMemoryStrategy), and how to apply
 * forget policies to clean up old memories.
 *
 * NOTE: Background extraction requires a task worker running on the server.
 * Start the server with: uv run agent-memory api --task-backend=asyncio
 *
 * Prerequisites:
 *   - Agent Memory Server running at http://localhost:8000 with task backend
 *   - OPENAI_API_KEY set in .env or environment
 *
 * Run: npx tsx 05-background-extraction-and-forget.ts
 */

import type { MemoryMessage } from "cau-redis-agent-memory";

import { config } from "dotenv";
config();

import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";

import { AgentMemory, ExtractionStrategy } from "cau-redis-agent-memory";

const AGENT_MEMORY_BASE_URL =
  process.env.AGENT_MEMORY_BASE_URL ?? "http://localhost:8000";
const NAMESPACE = "examples";
const SESSION_ID = `extract-demo-${Date.now()}`;
const USER_ID = "carol";
const MODEL_NAME = "gpt-4o-mini";
const EXTRACTION_WAIT_MS = 60000;

const run = async () => {
  const agentMemory = AgentMemory.create({
    baseUrl: AGENT_MEMORY_BASE_URL,
    defaultNamespace: NAMESPACE,
  });

  const llm = new ChatOpenAI({ modelName: MODEL_NAME, temperature: 0 });

  try {
    console.log("--- Background Extraction + Forget Demo ---\n");

    // 1. Build a realistic conversation
    const conversationTurns = [
      "Hi! I'm Carol, I live in San Francisco and work as a product manager at StartupXYZ.",
      "I love reading science fiction books, especially anything by Isaac Asimov.",
      "Last weekend I went to a great Japanese restaurant in the Mission district.",
    ];

    const messages: MemoryMessage[] = [];

    for (const userText of conversationTurns) {
      const llmResponse = await llm.invoke([new HumanMessage(userText)]);
      const assistantText =
        typeof llmResponse.content === "string"
          ? llmResponse.content
          : JSON.stringify(llmResponse.content);

      messages.push(
        { role: "user", content: userText },
        { role: "assistant", content: assistantText },
      );
    }

    console.log(`[1] Built conversation with ${messages.length} messages.\n`);

    // 2. Put working memory with discrete extraction strategy
    console.log(
      "[2] Storing conversation with discrete extraction strategy...",
    );
    await agentMemory.putWorkingMemory(
      SESSION_ID,
      {
        messages,
        userId: USER_ID,
        namespace: NAMESPACE,
        longTermMemoryStrategy: {
          strategy: ExtractionStrategy.DISCRETE,
        },
      },
      { namespace: NAMESPACE },
    );
    console.log("  Stored. Background extraction triggered.\n");

    // 3. Wait for extraction
    console.log(
      `[3] Waiting ${EXTRACTION_WAIT_MS}ms for background extraction...`,
    );
    await new Promise((r) => setTimeout(r, EXTRACTION_WAIT_MS));

    // 4. Search for extracted memories
    console.log("[4] Searching for auto-extracted memories...");
    const extracted = await agentMemory.searchLongTermMemory({
      text: "Carol",
      userId: { eq: USER_ID },
      namespace: { eq: NAMESPACE },
      limit: 20,
    });

    console.log(`  Found ${extracted.total} extracted memories:`);
    for (const mem of extracted.memories) {
      const topicStr = mem.topics?.join(", ") ?? "none";
      const entityStr = mem.entities?.join(", ") ?? "none";
      console.log(`    [${mem.memoryType}] ${mem.text}`);
      console.log(`      topics: ${topicStr} | entities: ${entityStr}`);
    }
    console.log("");

    // 5. Dry-run forget policy
    console.log("[5] Dry-run forget policy (maxAgeDays=0)...");
    const dryResult = await agentMemory.forgetLongTermMemories(
      { maxAgeDays: 0 },
      {
        namespace: NAMESPACE,
        userId: USER_ID,
        dryRun: true,
      },
    );
    console.log(`  Scanned: ${dryResult.scanned}`);
    console.log(`  Would delete: ${dryResult.deleted}`);
    console.log("");

    // 6. Execute forget (skip if nothing to delete)
    const hasToDelete = dryResult.deleted > 0;
    if (hasToDelete) {
      console.log("[6] Executing forget policy...");
      const forgetResult = await agentMemory.forgetLongTermMemories(
        { maxAgeDays: 0 },
        {
          namespace: NAMESPACE,
          userId: USER_ID,
          dryRun: false,
        },
      );
      console.log(`  Deleted: ${forgetResult.deleted} memories`);
    } else {
      console.log(
        "[6] No memories to forget (extraction may not have completed).",
      );
      console.log("    Make sure the server has task-backend enabled.");
    }
    console.log("");

    // 7. Verify memories are gone
    console.log("[7] Verifying memories are gone...");
    const afterForget = await agentMemory.searchLongTermMemory({
      text: "Carol",
      userId: { eq: USER_ID },
      namespace: { eq: NAMESPACE },
      limit: 20,
    });
    console.log(`  Remaining memories: ${afterForget.total}\n`);

    // 8. Clean up working memory
    console.log("[8] Deleting working memory session...");
    await agentMemory.deleteWorkingMemory(SESSION_ID, {
      userId: USER_ID,
      namespace: NAMESPACE,
    });

    // Clean up any remaining LT memories
    const hasRemaining = afterForget.memories.length > 0;
    if (hasRemaining) {
      await agentMemory.deleteLongTermMemories(
        afterForget.memories.map((m) => m.id),
      );
    }

    console.log("  Done.\n");
  } finally {
    await agentMemory.close();
  }
};

run().catch(console.error);
