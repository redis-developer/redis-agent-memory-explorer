import type { BaseMessage } from "@langchain/core/messages";
import type { CopilotKitState, DatasetConfig } from "../types";
import type { McpToolDef } from "../types";

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
import { RedisAgentMemory } from "cau-ram";
import { ContextSurfaces } from "cau-context-surfaces";
import { LangCache } from "cau-langcache";

import { Logger } from "cau-logger";
import { join } from "node:path";

import { createAllTools } from "./tools";
import { buildSystemPrompt } from "./system-prompt";
import { postProcessMessages } from "./source-attribution";
import { ChatbotCacheStrategy } from "./cache-strategy";
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
  if (!_logger) {
    _logger = Logger.getInstance().child({ component: "ChatbotGraph" });
  }
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
  //Since langgraph server runs in a separate process, we need to ensure that the AgentMemory is initialized

  const logger = getLogger();

  try {
    RedisAgentMemory.getInstance();
  } catch {
    RedisAgentMemory.create({
      ram: {
        endpoint: ENV.RAM_ENDPOINT,
        apiKey: ENV.RAM_API_KEY,
        storeId: ENV.RAM_STORE_ID,
      },
      llm: {
        model: ENV.BACKGROUND_MODEL,
        apiKey: ENV.OPENAI_API_KEY,
      },
    });
    logger.info("RedisAgentMemory initialized in LangGraph process", {
      userId: datasetConfig.userId,
    });
  }

  const hasCtxConfig =
    ENV.CTX_ADMIN_KEY !== "" &&
    ENV.CTX_SURFACE_ID !== "" &&
    ENV.MCP_AGENT_KEY !== "";
  let ctxSurfaceId = "";
  let mcpAgentKey = "";
  if (hasCtxConfig) {
    try {
      ContextSurfaces.getInstance();
    } catch {
      const cs = ContextSurfaces.create({
        adminKey: ENV.CTX_ADMIN_KEY,
        adminApiUrl: ENV.CTX_ADMIN_API_URL || undefined,
        mcpUrl: ENV.CTX_MCP_URL || undefined,
      });
      cs.setAgentKey(ENV.MCP_AGENT_KEY);
      ctxSurfaceId = ENV.CTX_SURFACE_ID;
      mcpAgentKey = ENV.MCP_AGENT_KEY;
      logger.info("ContextSurfaces initialized in LangGraph process", {
        surfaceId: ctxSurfaceId,
      });
    }
  }

  const hasLangCacheConfig =
    ENV.LANGCACHE_ENABLED &&
    ENV.LANGCACHE_SERVER_URL &&
    ENV.LANGCACHE_CACHE_ID &&
    ENV.LANGCACHE_API_KEY;
  if (hasLangCacheConfig) {
    try {
      LangCache.getInstance();
    } catch {
      LangCache.create({
        serverURL: ENV.LANGCACHE_SERVER_URL,
        cacheId: ENV.LANGCACHE_CACHE_ID,
        apiKey: ENV.LANGCACHE_API_KEY,
      });
      logger.info("LangCache initialized in LangGraph process", {
        serverURL: ENV.LANGCACHE_SERVER_URL,
      });
    }
  }

  setAppState({
    datasetConfig,
    userId: datasetConfig.userId,
    ctxSurfaceId,
    mcpAgentKey,
  });
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

const runAgent = async (
  state: typeof StateAnnotation.State,
  reactAgent: ReturnType<typeof createReactAgent>,
  datasetConfig: DatasetConfig,
  mcpToolDefs: McpToolDef[],
): Promise<BaseMessage[]> => {
  const logger = getLogger();
  const systemPrompt = buildSystemPrompt(datasetConfig, mcpToolDefs);
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

  const inputCount = messagesWithSystemPrompt.length;
  const startMs = Date.now();
  const result = await reactAgent.invoke(
    { messages: messagesWithSystemPrompt },
    { recursionLimit: 50 },
  );

  const newMessages = result.messages.slice(inputCount);
  const processedMessages = postProcessMessages(newMessages);

  logger.info("ReAct agent completed", {
    responseMessageCount: processedMessages.length,
    latencyMs: Date.now() - startMs,
  });

  return processedMessages;
};

const runAgentWithCache = async (
  state: typeof StateAnnotation.State,
  reactAgent: ReturnType<typeof createReactAgent>,
  datasetConfig: DatasetConfig,
  mcpToolDefs: McpToolDef[],
): Promise<{ messages: BaseMessage[] }> => {
  let result: { messages: BaseMessage[] };

  const turn = await ChatbotCacheStrategy.lookup(
    state.copilotkit,
    state.messages,
    datasetConfig,
  );

  if (turn.hit) {
    result = { messages: [turn.hit] };
  } else {
    const messages = await runAgent(
      state,
      reactAgent,
      datasetConfig,
      mcpToolDefs,
    );
    await ChatbotCacheStrategy.store(turn, messages);
    result = { messages };
  }

  return result;
};

const createCompiledGraph = async () => {
  ensureLoggerInitialized();

  const datasetConfig = DatasetLoaderService.loadDatasetConfig(
    ENV.ACTIVE_DATASET,
  );

  ensureInitialized(datasetConfig);

  const llm = new ChatOpenAI({
    model: ENV.CHATBOT_MODEL,
    temperature: 0,
    apiKey: ENV.OPENAI_API_KEY,
  });

  const { tools, mcpToolDefs } = await createAllTools();
  const reactAgent = createReactAgent({ llm, tools });

  const graph = new StateGraph(StateAnnotation)
    .addNode("reactNode", (state) =>
      runAgentWithCache(state, reactAgent, datasetConfig, mcpToolDefs),
    )
    .addEdge(START, "reactNode")
    .addEdge("reactNode", END);

  return graph.compile();
};

const compiledGraph = createCompiledGraph();

export { compiledGraph };
