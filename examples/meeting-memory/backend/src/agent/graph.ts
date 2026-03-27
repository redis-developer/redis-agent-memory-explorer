import type { BaseMessage } from "@langchain/core/messages";
import type { DatasetConfig } from "../types";

import {
  MessagesAnnotation,
  StateGraph,
  START,
  END,
  Annotation,
} from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage } from "@langchain/core/messages";
import { AgentMemory } from "cau-redis-agent-memory";

import { createMemoryTools } from "./tools";
import { buildSystemPrompt } from "./system-prompt";
import { DatasetLoaderService } from "../services/dataset-loader.service";
import { ENV } from "../config";
import { setAppState } from "../app-state";

const StateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
});

const ensureInitialized = (datasetConfig: DatasetConfig): void => {
  //since langgraph server runs in a separate process, we need to ensure that the AgentMemory is initialized
  try {
    AgentMemory.getInstance();
  } catch {
    AgentMemory.create({
      baseUrl: ENV.AGENT_MEMORY_BASE_URL,
      defaultNamespace: datasetConfig.namespace,
      defaultModelName: ENV.MODEL_NAME,
    });
    setAppState({
      datasetConfig,
      namespace: datasetConfig.namespace,
      userId: datasetConfig.userId,
    });
  }
};

// CopilotKit injects useCopilotReadable values as system messages into state.messages
// before the user's question. The LLM sees a messages array like:
//
//   [
//     SystemMessage (buildSystemPrompt -- routing rules, capabilities),
//     SystemMessage ("Active session ID for the current meeting playback: playback-2026-02-26-google-meet-..."),
//     SystemMessage ("User ID for memory scoping: sarah-chen"),
//     SystemMessage ("Namespace for memory scoping: wealth-advisor"),
//     HumanMessage  ("What happened in this meeting?"),
//   ]
//
// The system prompt tells the LLM to read the active session ID from these
// CopilotKit-injected messages and use it for session-scoped tool calls.
const invokeReactNode = async (
  state: typeof StateAnnotation.State,
  reactAgent: ReturnType<typeof createReactAgent>,
  datasetConfig: DatasetConfig,
): Promise<{ messages: BaseMessage[] }> => {
  const systemPrompt = buildSystemPrompt(datasetConfig);

  const messagesWithSystemPrompt = [
    new SystemMessage(systemPrompt),
    ...state.messages,
  ];

  const result = await reactAgent.invoke({
    messages: messagesWithSystemPrompt,
  });

  return { messages: result.messages };
};

const createCompiledGraph = () => {
  const datasetConfig = DatasetLoaderService.loadDatasetConfig(
    ENV.ACTIVE_DATASET,
  );

  ensureInitialized(datasetConfig);

  const llm = new ChatOpenAI({
    model: ENV.CHATBOT_MODEL,
    temperature: 0,
    apiKey: ENV.OPENAI_API_KEY,
  });

  const tools = createMemoryTools();
  const reactAgent = createReactAgent({ llm, tools });

  const graph = new StateGraph(StateAnnotation)
    .addNode("reactNode", (state) => invokeReactNode(state, reactAgent, datasetConfig))
    .addEdge(START, "reactNode")
    .addEdge("reactNode", END);

  return graph.compile();
};

const compiledGraph = createCompiledGraph();

export { compiledGraph };
