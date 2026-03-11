/**
 * Example 3: LangGraph Agent with Memory Tools
 *
 * Builds a LangGraph StateGraph agent where the LLM decides when to
 * store/search/edit memories via tool calling. Follows the production
 * pattern: memoryPrompt for context hydration, tools for memory CRUD,
 * putWorkingMemory for conversation state only (no background extraction).
 *
 * Prerequisites:
 *   - Agent Memory Server running at http://localhost:8000
 *   - OPENAI_API_KEY set in .env or environment
 *
 * Run: npx tsx 03-langgraph-memory-agent.ts
 */

import type { BaseMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import type { MemoryMessage } from "cau-redis-agent-memory";

import { config } from "dotenv";
config();

import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";

import { AgentMemory, MemoryType } from "cau-redis-agent-memory";

const AGENT_MEMORY_BASE_URL =
  process.env.AGENT_MEMORY_BASE_URL ?? "http://localhost:8000";
const NAMESPACE = "examples";
const SESSION_ID = `agent-demo-${Date.now()}`;
const USER_ID = "bob";
const MODEL_NAME = "gpt-4o-mini";

const USER_TURNS = [
  "I'm Bob, I work at Acme Corp as a data engineer.",
  "What do you know about me?",
  "Actually I recently got promoted to senior data engineer.",
];

const buildTools = (agentMemory: AgentMemory): StructuredToolInterface[] => {
  const storeMemoryTool: StructuredToolInterface = tool(
    async (input: { text: string; memoryType?: string; topics?: string[] }) => {
      await agentMemory.createLongTermMemories([
        {
          text: input.text,
          memoryType: (input.memoryType as typeof MemoryType[keyof typeof MemoryType]) ?? MemoryType.SEMANTIC,
          topics: input.topics,
          userId: USER_ID,
          namespace: NAMESPACE,
        },
      ]);

      return `Stored memory: "${input.text}"`;
    },
    {
      name: "store_memory",
      description:
        "Store a fact, preference, or event about the user into long-term memory.",
      schema: z.object({
        text: z.string().describe("The memory text to store"),
        memoryType: z
          .enum(["semantic", "episodic", "message"])
          .optional()
          .describe("Type of memory: semantic (fact), episodic (event), message"),
        topics: z
          .array(z.string())
          .optional()
          .describe("Topic tags for the memory"),
      }),
    },
  );

  const searchMemoryTool: StructuredToolInterface = tool(
    async (input: { query: string; limit?: number }) => {
      const result = await agentMemory.searchLongTermMemory({
        text: input.query,
        userId: { eq: USER_ID },
        namespace: { eq: NAMESPACE },
        limit: input.limit ?? 5,
      });

      const isEmpty = result.memories.length === 0;

      return isEmpty
        ? "No memories found."
        : result.memories
            .map((m) => `[${m.id}] (${m.memoryType}) ${m.text}`)
            .join("\n");
    },
    {
      name: "search_memory",
      description: "Search the user's long-term memories by semantic query.",
      schema: z.object({
        query: z.string().describe("Semantic search query"),
        limit: z.number().optional().describe("Max results to return"),
      }),
    },
  );

  const editMemoryTool: StructuredToolInterface = tool(
    async (input: { memoryId: string; newText: string }) => {
      const edited = await agentMemory.editLongTermMemory(input.memoryId, {
        text: input.newText,
      });

      return `Updated memory ${edited.id}: "${edited.text}"`;
    },
    {
      name: "edit_memory",
      description: "Edit an existing long-term memory by ID.",
      schema: z.object({
        memoryId: z.string().describe("The ID of the memory to edit"),
        newText: z.string().describe("The new text for the memory"),
      }),
    },
  );

  return [storeMemoryTool, searchMemoryTool, editMemoryTool];
};

const mapMemoryMsgToLangChain = (msg: { role: string; content: string }): BaseMessage => {
  const content = msg.content ?? "";
  const isUser = msg.role === "user";
  const isAssistant = msg.role === "assistant";

  const result = isUser
    ? new HumanMessage(content)
    : isAssistant
      ? new AIMessage(content)
      : new SystemMessage(content);

  return result;
};

const run = async () => {
  const agentMemory = AgentMemory.create({
    baseUrl: AGENT_MEMORY_BASE_URL,
    defaultNamespace: NAMESPACE,
  });

  const tools = buildTools(agentMemory);
  const llm = new ChatOpenAI({ modelName: MODEL_NAME, temperature: 0 });
  const llmWithTools = llm.bindTools(tools);

  // Build the graph
  const callModel = async (state: typeof MessagesAnnotation.State) => {
    const response = await llmWithTools.invoke(state.messages);

    return { messages: [response] };
  };

  const shouldContinue = (state: typeof MessagesAnnotation.State) => {
    const lastMessage = state.messages[state.messages.length - 1];
    const hasToolCalls =
      "tool_calls" in lastMessage &&
      Array.isArray(lastMessage.tool_calls) &&
      lastMessage.tool_calls.length > 0;

    return hasToolCalls ? "tools" : END;
  };

  const toolNode = new ToolNode(tools);

  const graph = new StateGraph(MessagesAnnotation)
    .addNode("llm", callModel)
    .addNode("tools", toolNode)
    .addEdge(START, "llm")
    .addConditionalEdges("llm", shouldContinue, { tools: "tools", [END]: END })
    .addEdge("tools", "llm")
    .compile();

  try {
    console.log("--- LangGraph Memory Agent Demo ---\n");

    await agentMemory.getOrCreateWorkingMemory(SESSION_ID, {
      userId: USER_ID,
      namespace: NAMESPACE,
    });

    for (const userText of USER_TURNS) {
      console.log(`[User]: ${userText}`);

      // 1. memoryPrompt for context hydration
      const promptResult = await agentMemory.memoryPrompt({
        query: userText,
        session: {
          sessionId: SESSION_ID,
          userId: USER_ID,
          modelName: MODEL_NAME,
        },
        longTermSearch: true,
      });

      // 2. Build initial messages for the graph
      const contextMessages = promptResult.messages.map(mapMemoryMsgToLangChain);
      contextMessages.push(new HumanMessage(userText));

      // 3. Run the graph (LLM may call tools in a loop)
      const result = await graph.invoke({ messages: contextMessages });

      const finalMessages: BaseMessage[] = result.messages;
      const lastMsg = finalMessages[finalMessages.length - 1];
      const assistantText =
        typeof lastMsg.content === "string"
          ? lastMsg.content
          : JSON.stringify(lastMsg.content);

      console.log(`[Assistant]: ${assistantText}\n`);

      // 4. Fetch-append-put conversation to working memory (no extraction strategy)
      //    Pass userId so the Redis key matches the one created by putWorkingMemory.
      const current = await agentMemory.getWorkingMemory(SESSION_ID, {
        userId: USER_ID,
        namespace: NAMESPACE,
      });
      const existingMessages: MemoryMessage[] = current?.messages ?? [];

      await agentMemory.putWorkingMemory(
        SESSION_ID,
        {
          messages: [
            ...existingMessages,
            { role: "user", content: userText },
            { role: "assistant", content: assistantText },
          ],
          userId: USER_ID,
          namespace: NAMESPACE,
        },
        { namespace: NAMESPACE },
      );

      // Small delay for LT memory indexing between turns
      await new Promise((r) => setTimeout(r, 1500));
    }

    // 5. Show what was stored in long-term memory
    console.log("\n--- Long-term memories created by agent ---");
    const ltMemories = await agentMemory.searchLongTermMemory({
      text: "Bob",
      userId: { eq: USER_ID },
      namespace: { eq: NAMESPACE },
      limit: 10,
    });

    for (const mem of ltMemories.memories) {
      console.log(`  [${mem.memoryType}] ${mem.text}`);
    }

    // 6. Clean up
    console.log("\n--- Cleanup ---");
    await agentMemory.deleteWorkingMemory(SESSION_ID, {
      userId: USER_ID,
      namespace: NAMESPACE,
    });

    const hasLtMems = ltMemories.memories.length > 0;
    if (hasLtMems) {
      await agentMemory.deleteLongTermMemories(
        ltMemories.memories.map((m) => m.id),
      );
    }

    console.log("  Done.\n");
  } finally {
    await agentMemory.close();
  }
};

run().catch(console.error);
