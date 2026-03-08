/**
 * Example 4: Summary Views Flow
 *
 * Demonstrates create, list, run partition (sync), run full (async + poll),
 * list partitions, and delete on summary views.
 *
 * Prerequisites:
 *   - Agent Memory Server running at http://localhost:8000 (with FAST_MODEL environment variable set)
     
 *
 * Run: npx tsx 04-summary-views-flow.ts
 */

import { config } from "dotenv";
config();

import {
  AgentMemory,
  MemoryType,
  SummaryViewSource,
  TaskStatus,
} from "cau-redis-agent-memory";

const AGENT_MEMORY_BASE_URL =
  process.env.AGENT_MEMORY_BASE_URL ?? "http://localhost:8000";
const NAMESPACE = "examples";
const SEED_DELAY_MS = 2000;
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 15;

const run = async () => {
  const agentMemory = AgentMemory.create({
    baseUrl: AGENT_MEMORY_BASE_URL,
    defaultNamespace: NAMESPACE,
  });

  const seededIds: string[] = [];
  let viewId: string | null = null;

  try {
    console.log("--- Summary Views Flow Demo ---\n");

    // 1. Seed long-term memories for two users
    console.log("[1] Seeding memories for two users...");
    await agentMemory.createLongTermMemories([
      {
        text: "Alice loves hiking in the Swiss Alps",
        memoryType: MemoryType.SEMANTIC,
        topics: ["travel", "hiking"],
        userId: "alice",
        namespace: NAMESPACE,
      },
      {
        text: "Alice is a senior software engineer at TechCorp",
        memoryType: MemoryType.SEMANTIC,
        topics: ["career"],
        userId: "alice",
        namespace: NAMESPACE,
      },
      {
        text: "Bob works at Acme Corp as a data engineer",
        memoryType: MemoryType.SEMANTIC,
        topics: ["career"],
        userId: "bob",
        namespace: NAMESPACE,
      },
      {
        text: "Bob enjoys cooking Italian food",
        memoryType: MemoryType.SEMANTIC,
        topics: ["food", "cooking"],
        userId: "bob",
        namespace: NAMESPACE,
      },
    ]);

    console.log(
      `  Seeded 4 memories. Waiting ${SEED_DELAY_MS}ms for indexing...\n`,
    );
    await new Promise((r) => setTimeout(r, SEED_DELAY_MS));

    // Collect IDs for cleanup
    const aliceMems = await agentMemory.searchLongTermMemory({
      text: "Alice",
      userId: { eq: "alice" },
      namespace: { eq: NAMESPACE },
      limit: 10,
    });
    const bobMems = await agentMemory.searchLongTermMemory({
      text: "Bob",
      userId: { eq: "bob" },
      namespace: { eq: NAMESPACE },
      limit: 10,
    });
    seededIds.push(
      ...aliceMems.memories.map((m) => m.id),
      ...bobMems.memories.map((m) => m.id),
    );

    // 2. Create a summary view grouped by user_id
    console.log("[2] Creating summary view grouped by user_id...");
    const view = await agentMemory.createSummaryView({
      name: `demo-view-${Date.now()}`,
      source: SummaryViewSource.LONG_TERM,
      groupBy: ["user_id"],
      timeWindowDays: 30,
    });
    viewId = view.id;
    console.log(`  View created: id=${view.id}, name=${view.name}\n`);

    // 3. List summary views
    console.log("[3] Listing summary views...");
    const views = await agentMemory.listSummaryViews();
    console.log(`  Total views: ${views.length}`);

    const found = views.find((v) => v.id === viewId);
    console.log(`  Our view present: ${found !== undefined}\n`);

    // 4. Run sync partition for Alice
    console.log("[4] Running sync partition for user_id=alice...");
    const alicePartition = await agentMemory.runSummaryViewPartition(viewId, {
      user_id: "alice",
    });
    console.log(`  Summary: ${alicePartition.summary}`);
    console.log(`  Memory count: ${alicePartition.memoryCount}\n`);

    // 5. Run async full recompute
    console.log("[5] Running async full recompute...");
    const task = await agentMemory.runSummaryView(viewId, { force: true });
    console.log(`  Task created: id=${task.id}, status=${task.status}`);

    // 6. Poll task until completion
    console.log("[6] Polling task status...");
    let pollCount = 0;
    let currentTask = task;

    const isTerminal =
      currentTask.status === TaskStatus.COMPLETED ||
      currentTask.status === TaskStatus.FAILED;

    let done = isTerminal;

    while (!done && pollCount < MAX_POLLS) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      pollCount++;

      const polled = await agentMemory.getTask(task.id);
      const isNull = polled === null;

      if (isNull) {
        console.log(`  Poll ${pollCount}: task not found`);
        done = true;
      } else {
        currentTask = polled!;
        console.log(`  Poll ${pollCount}: status=${currentTask.status}`);

        const nowTerminal =
          currentTask.status === TaskStatus.COMPLETED ||
          currentTask.status === TaskStatus.FAILED;
        done = nowTerminal;
      }
    }

    console.log(`  Final status: ${currentTask.status}\n`);

    // 7. List materialized partitions
    console.log("[7] Listing materialized partitions...");
    const partitions = await agentMemory.listSummaryViewPartitions(viewId);
    console.log(`  Partitions: ${partitions.length}`);

    for (const p of partitions) {
      console.log(
        `    group=${JSON.stringify(p.group)}, memories=${p.memoryCount}`,
      );
      console.log(`    summary: ${p.summary.slice(0, 120)}...`);
    }
    console.log("");

    // 8. Delete summary view
    console.log("[8] Deleting summary view...");

    await new Promise((r) => setTimeout(r, 5000));

    await agentMemory.deleteSummaryView(viewId);
    viewId = null;
    console.log("  Deleted.\n");

    // 9. Delete seeded memories
    console.log(`[9] Deleting ${seededIds.length} seeded memories...`);
    const hasIds = seededIds.length > 0;
    if (hasIds) {
      await agentMemory.deleteLongTermMemories(seededIds);
    }
    console.log("  Done.\n");
  } finally {
    const hasView = viewId !== null;
    if (hasView) {
      await agentMemory.deleteSummaryView(viewId!).catch(() => {});
    }

    const hasSeeds = seededIds.length > 0;
    if (hasSeeds) {
      await agentMemory.deleteLongTermMemories(seededIds).catch(() => {});
    }

    await agentMemory.close();
  }
};

run().catch(console.error);
