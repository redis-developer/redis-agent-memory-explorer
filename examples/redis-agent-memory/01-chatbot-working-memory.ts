/**
 * Example 1: Chatbot with Working Memory
 *
 * Demonstrates the core chatbot loop:
 *   memoryPrompt -> LLM -> getWorkingMemory -> putWorkingMemory
 *
 * IMPORTANT: The Agent Memory Server includes user_id in the Redis key for
 * working memory. You MUST pass userId consistently to ALL working memory
 * operations (get, put, delete) or they will look up different Redis keys.
 * The SDK (agent-memory-client@0.3.x) does not support userId in GET/DELETE,
 * so our wrapper bypasses the SDK for those calls when userId is provided.
 *
 * See: https://github.com/redis/agent-memory-server/issues/185
 *
 * Prerequisites:
 *   - Agent Memory Server running at http://localhost:8000
 *   - OPENAI_API_KEY set in .env or environment
 *
 * Run: npx tsx 01-chatbot-working-memory.ts
 */

import type { MemoryMessage } from "cau-redis-agent-memory";

import { config } from "dotenv";
config();

import { ChatOpenAI } from "@langchain/openai";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";

import { AgentMemory } from "cau-redis-agent-memory";

const AGENT_MEMORY_BASE_URL =
  process.env.AGENT_MEMORY_BASE_URL ?? "http://localhost:8000";
const NAMESPACE = "examples";
const SESSION_ID = `chatbot-demo-x-${Date.now()}`;
const USER_ID = "Arjun";
const MODEL_NAME = "gpt-4o-mini";

const USER_TURNS = [
  "Hi, I'm Arjun, a software engineer who loves hiking.",
  "I'm planning a trip to the Neelakurinji Hills next month.",
  "What kind of gear should I bring for mountain hiking?",
  "I also want to try some local Swiss food. Any recommendations?",
  "Thanks! Can you remind me what we talked about?",
];

const mapMemoryMsgToLangChain = (msg: { role: string; content: string }) => {
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

  const llm = new ChatOpenAI({ modelName: MODEL_NAME, temperature: 0 });

  try {
    console.log("--- Chatbot Working Memory Demo ---\n");

    const { created, memory: initialMemory } =
      await agentMemory.getOrCreateWorkingMemory(SESSION_ID, {
        userId: USER_ID,
        namespace: NAMESPACE,
      });
    console.log(
      `Session ${SESSION_ID}: created=${created}, messages=${initialMemory.messages.length}\n`,
    );

    for (const userText of USER_TURNS) {
      console.log(`[User]: ${userText}`);

      // 1. memoryPrompt hydrates context from working memory + long-term search
      const promptResult = await agentMemory.memoryPrompt({
        query: userText,
        session: {
          sessionId: SESSION_ID,
          userId: USER_ID,
          modelName: MODEL_NAME,
        },
        longTermSearch: true,
      });

      // 2. Convert to LangChain messages and invoke LLM
      const lcMessages = promptResult.messages.map(mapMemoryMsgToLangChain);
      lcMessages.push(new HumanMessage(userText));

      const llmResponse = await llm.invoke(lcMessages);
      const assistantText =
        typeof llmResponse.content === "string"
          ? llmResponse.content
          : JSON.stringify(llmResponse.content);

      console.log(`[Assistant]: ${assistantText}\n`);

      // 3. Fetch current working memory — userId MUST match the putWorkingMemory
      //    call, otherwise the server looks up a different Redis key.
      const current = await agentMemory.getWorkingMemory(SESSION_ID, {
        userId: USER_ID,
        namespace: NAMESPACE,
      });
      const existingMessages: MemoryMessage[] = current?.messages ?? [];

      // 4. Append new turn and put back (putWorkingMemory replaces, not appends)
      const updatedMessages: MemoryMessage[] = [
        ...existingMessages,
        { role: "user", content: userText },
        { role: "assistant", content: assistantText },
      ];

      const putResult = await agentMemory.putWorkingMemory(
        SESSION_ID,
        {
          messages: updatedMessages,
          userId: USER_ID,
          namespace: NAMESPACE,
        },
        { namespace: NAMESPACE, modelName: MODEL_NAME },
      );

      console.log(
        `  [Memory] messages=${putResult.messages.length}, tokens=${putResult.tokens}`,
      );

      const hasContext = putResult.context !== null;
      if (hasContext) {
        console.log(
          `  [Memory] context summary present (${putResult.context!.length} chars)`,
        );
      }

      const hasPercentage = putResult.contextPercentageTotalUsed !== null;
      if (hasPercentage) {
        console.log(
          `  [Memory] context used: ${putResult.contextPercentageTotalUsed}%, until summarization: ${putResult.contextPercentageUntilSummarization}%`,
        );
      }

      console.log("");
    }

    // 5. Inspect final state (pass userId to read the correct key)
    const finalState = await agentMemory.getWorkingMemory(SESSION_ID, {
      userId: USER_ID,
      namespace: NAMESPACE,
      modelName: MODEL_NAME,
    });

    console.log("--- Final Working Memory State ---");
    console.log(`  Session: ${finalState?.sessionId}`);
    console.log(`  Messages: ${finalState?.messages.length}`);
    console.log(`  Context: ${finalState?.context ? "present" : "none"}`);
    console.log(`  Tokens: ${finalState?.tokens}`);

    // 6. Verify session in list
    const sessions = await agentMemory.listSessions({ namespace: NAMESPACE });
    const found = sessions.sessions.includes(SESSION_ID);
    console.log(
      `\n  Session in list: ${found} (total sessions: ${sessions.total})`,
    );

    //7. Clean up (pass userId so the correct key is deleted)
    await agentMemory.deleteWorkingMemory(SESSION_ID, {
      userId: USER_ID,
      namespace: NAMESPACE,
    });
    console.log("\n  Session deleted. Done.");
  } finally {
    await agentMemory.close();
  }
};

run().catch(console.error);
