import type { IncomingMessage, ServerResponse } from "node:http";

import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNodeHttpEndpoint,
} from "@copilotkit/runtime";
import { LangGraphAgent } from "@copilotkit/runtime/langgraph";
import { Logger } from "cau-logger";

import { ENV } from "../config";
import { COPILOTKIT_ENDPOINT, COPILOTKIT_GRAPH_ID } from "../constants";

let _logger: ReturnType<typeof Logger.getInstance> | null = null;
const getLogger = () => {
  if (!_logger) _logger = Logger.getInstance().child({ component: "CopilotKitLangGraph" });
  return _logger;
};

const serviceAdapter = new ExperimentalEmptyAdapter();

const langGraphAgentConfig = {
  deploymentUrl: ENV.LANGGRAPH_DEPLOYMENT_URL,
  graphId: COPILOTKIT_GRAPH_ID,
  langsmithApiKey: ENV.LANGSMITH_API_KEY,
};

const runtime = new CopilotRuntime({
  agents: {
    default: new LangGraphAgent(langGraphAgentConfig),
  },
});

const handleCopilotKitLanggraph = async (
  req: IncomingMessage,
  res: ServerResponse,
): Promise<unknown> => {
  const logger = getLogger();
  logger.info("CopilotKit request received", { method: req.method, url: req.url });

  const startMs = Date.now();
  const handler = copilotRuntimeNodeHttpEndpoint({
    endpoint: COPILOTKIT_ENDPOINT,
    runtime,
    serviceAdapter,
  });

  const result = await handler(req, res);

  logger.info("CopilotKit request handled", { latencyMs: Date.now() - startMs });

  return result;
};

export { handleCopilotKitLanggraph };
