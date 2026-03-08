/**
 * Example 2: Long-Term Memory CRUD Flow
 *
 * Demonstrates create, semantic search, get, edit, delete on long-term memories.
 * Pure data operations -- no chatbot loop or LLM calls needed.
 *
 * Prerequisites:
 *   - Agent Memory Server running at http://localhost:8000
 *
 * Run: npx tsx 02-long-term-memory-crud.ts
 */

import { config } from "dotenv";
config();

import { AgentMemory, MemoryType } from "cau-redis-agent-memory";

const AGENT_MEMORY_BASE_URL =
  process.env.AGENT_MEMORY_BASE_URL ?? "http://localhost:8000";
const NAMESPACE = "examples";
const USER_ID = "alice";
const SEARCH_DELAY_MS = 2000;

const run = async () => {
  const agentMemory = AgentMemory.create({
    baseUrl: AGENT_MEMORY_BASE_URL,
    defaultNamespace: NAMESPACE,
  });

  const createdIds: string[] = [];

  try {
    console.log("--- Long-Term Memory CRUD Demo ---\n");

    // 1. Create memories
    console.log("[1] Creating 3 long-term memories...");
    await agentMemory.createLongTermMemories([
      {
        text: "Alice is a software engineer at TechCorp",
        memoryType: MemoryType.SEMANTIC,
        topics: ["career", "engineering"],
        userId: USER_ID,
        namespace: NAMESPACE,
      },
      {
        text: "Alice prefers Python over JavaScript for data work",
        memoryType: MemoryType.SEMANTIC,
        topics: ["programming", "preferences"],
        userId: USER_ID,
        namespace: NAMESPACE,
      },
      {
        text: "Alice visited Paris in March 2024",
        memoryType: MemoryType.EPISODIC,
        topics: ["travel"],
        entities: ["Paris"],
        userId: USER_ID,
        namespace: NAMESPACE,
        eventDate: "2024-03-15",
      },
    ]);
    console.log("  Created 3 memories.\n");

    // Wait for indexing
    console.log(`  Waiting ${SEARCH_DELAY_MS}ms for indexing...`);
    await new Promise((r) => setTimeout(r, SEARCH_DELAY_MS));

    // 2. Semantic search -- programming languages
    console.log("[2] Searching for 'programming languages'...");
    const searchResult1 = await agentMemory.searchLongTermMemory({
      text: "programming languages",
      userId: { eq: USER_ID },
      namespace: { eq: NAMESPACE },
      limit: 5,
    });

    console.log(`  Found ${searchResult1.total} results:`);
    for (const mem of searchResult1.memories) {
      console.log(`    - [${mem.memoryType}] ${mem.text} (dist: ${mem.dist})`);
      createdIds.push(mem.id);
    }
    console.log("");

    // 3. Search with topic filter -- travel
    console.log("[3] Searching for 'travel' with topic filter...");
    const searchResult2 = await agentMemory.searchLongTermMemory({
      text: "travel",
      topics: { any: ["travel"] },
      userId: { eq: USER_ID },
      namespace: { eq: NAMESPACE },
      limit: 5,
    });

    console.log(`  Found ${searchResult2.total} results:`);
    for (const mem of searchResult2.memories) {
      console.log(
        `    - [${mem.memoryType}] ${mem.text} (event: ${mem.eventDate})`,
      );
      const isNew = !createdIds.includes(mem.id);
      if (isNew) {
        createdIds.push(mem.id);
      }
    }
    console.log("");

    // 4. Get a specific memory by ID
    const targetId = createdIds[0];
    console.log(`[4] Getting memory by ID: ${targetId}...`);
    const singleMem = await agentMemory.getLongTermMemory(targetId);
    console.log(`  Text: ${singleMem?.text}`);
    console.log(`  Type: ${singleMem?.memoryType}`);
    console.log(`  Topics: ${singleMem?.topics?.join(", ")}`);
    console.log("");

    // 5. Edit a memory -- Alice got promoted
    console.log(`[5] Editing memory ${targetId}...`);
    const edited = await agentMemory.editLongTermMemory(targetId, {
      text: "Alice is a SENIOR software engineer at TechCorp",
      topics: ["career", "engineering", "senior"],
    });
    console.log(`  Updated text: ${edited.text}`);
    console.log(`  Updated topics: ${edited.topics?.join(", ")}`);
    console.log("");

    // 6. Search again to verify edit
    console.log("[6] Verifying edit via search...");
    await new Promise((r) => setTimeout(r, SEARCH_DELAY_MS));

    const verifySearch = await agentMemory.searchLongTermMemory({
      text: "senior engineer",
      userId: { eq: USER_ID },
      namespace: { eq: NAMESPACE },
      limit: 3,
    });

    const foundEdited = verifySearch.memories.some((m) =>
      m.text.includes("SENIOR"),
    );
    console.log(`  Found edited memory: ${foundEdited}`);
    console.log("");

    // 7. Delete all created memories
    // console.log(`[7] Deleting ${createdIds.length} memories...`);
    // await agentMemory.deleteLongTermMemories(createdIds);
    // console.log("  Deleted. Done.\n");
  } finally {
    await agentMemory.close();
  }
};

run().catch(console.error);
