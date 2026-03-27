import type { IncomingMessage, ServerResponse } from "node:http";

import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNodeHttpEndpoint,
} from "@copilotkit/runtime";
import { LangGraphAgent } from "@copilotkit/runtime/langgraph";

import { ENV } from "../config";
import { COPILOTKIT_ENDPOINT, COPILOTKIT_GRAPH_ID } from "../constants";

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
  const handler = copilotRuntimeNodeHttpEndpoint({
    endpoint: COPILOTKIT_ENDPOINT,
    runtime,
    serviceAdapter,
  });

  return handler(req, res);
};

export { handleCopilotKitLanggraph };
