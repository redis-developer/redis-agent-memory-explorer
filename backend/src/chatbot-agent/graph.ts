import type { BaseMessage } from "@langchain/core/messages";
import type { CopilotKitState, DatasetConfig } from "../types";

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

import { Logger } from "cau-logger";
import { join } from "node:path";

import { createMemoryTools } from "./tools";
import { buildSystemPrompt } from "./system-prompt";
import { DatasetLoaderService } from "../services/dataset-loader.service";
import { ENV } from "../config";
import { setAppState } from "../app-state";
import { LOGGER_CONTEXT, DEFAULT_LOG_FILE } from "../constants";

const ensureLoggerInitialized = (): void => {
  try {
    Logger.getInstance();
  } catch {
    Logger.create({
      level: "info",
      context: LOGGER_CONTEXT,
      transports: [
        { type: "console", format: "pretty" },
        {
          type: "file",
          path: join(ENV.LOG_DIR, DEFAULT_LOG_FILE),
          rotation: "daily",
          maxFiles: 7,
          mkdir: true,
        },
      ],
    });
  }
};

let _logger: ReturnType<typeof Logger.getInstance> | null = null;
const getLogger = () => {
  if (!_logger)
    _logger = Logger.getInstance().child({ component: "ChatbotGraph" });
  return _logger;
};

const StateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  copilotkit: Annotation<CopilotKitState>({
    reducer: (_, next) => next,
    default: () => ({}),
  }),
});

const ensureInitialized = (datasetConfig: DatasetConfig): void => {
  //since langgraph server runs in a separate process, we need to ensure that the AgentMemory is initialized

  ensureLoggerInitialized();

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
    const logger = getLogger();
    logger.info("AgentMemory initialized in LangGraph process", {
      namespace: datasetConfig.namespace,
      userId: datasetConfig.userId,
    });
  }
};

// CopilotKit passes useCopilotReadable values via state.copilotkit.context (NOT
// as system messages in state.messages). We extract them here and inject them as
// SystemMessages so the LLM sees:
//
//   [
//     SystemMessage (buildSystemPrompt -- routing rules, capabilities),
//     SystemMessage ("Active session ID for the current meeting playback: playback-2026-02-26-google-meet-..."),
//     SystemMessage ("User ID for memory scoping: sarah-chen"),
//     SystemMessage ("Namespace for memory scoping: wealth-advisor"),
//     HumanMessage  ("What happened in this meeting?"),
//   ]
const buildReadableMessages = (
  copilotkit: CopilotKitState,
): SystemMessage[] => {
  const readables = copilotkit?.context ?? [];
  return readables.map(
    (r) => new SystemMessage(`${r.description}: ${r.value}`),
  );
};

const invokeReactNode = async (
  state: typeof StateAnnotation.State,
  reactAgent: ReturnType<typeof createReactAgent>,
  datasetConfig: DatasetConfig,
): Promise<{ messages: BaseMessage[] }> => {
  const logger = getLogger();
  const systemPrompt = buildSystemPrompt(datasetConfig);
  const readableMessages = buildReadableMessages(state.copilotkit);

  const messagesWithSystemPrompt = [
    new SystemMessage(systemPrompt),
    ...readableMessages,
    ...state.messages,
  ];

  logger.info("Invoking ReAct agent", {
    userMessageCount: state.messages.length,
    readableCount: readableMessages.length,
    totalMessages: messagesWithSystemPrompt.length,
  });

  const startMs = Date.now();
  const result = await reactAgent.invoke({
    messages: messagesWithSystemPrompt,
  });

  logger.info("ReAct agent completed", {
    responseMessageCount: result.messages.length,
    latencyMs: Date.now() - startMs,
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
    .addNode("reactNode", (state) =>
      invokeReactNode(state, reactAgent, datasetConfig),
    )
    .addEdge(START, "reactNode")
    .addEdge("reactNode", END);

  return graph.compile();
};

const compiledGraph = createCompiledGraph();

export { compiledGraph };
