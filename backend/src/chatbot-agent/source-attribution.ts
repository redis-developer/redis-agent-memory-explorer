import type { BaseMessage } from "@langchain/core/messages";

import { AIMessage, ToolMessage } from "@langchain/core/messages";

import { Logger } from "cau-logger";

const RAM_TOOL_SOURCE_MAP: Record<string, string> = {
  searchMemories: "RAM Long-Term Memory",
  searchMemoriesBySession: "RAM Session Memory",
  getSessionState: "RAM Session Memory",
  getMemoryContext: "RAM Session + Long-Term Memory",
  listSessions: "RAM Session Memory",
};

const CONTEXT_RETRIEVER_PREFIXES = ["get_", "filter_", "search_", "find_"];

const DEFAULT_SOURCE = "Chat History";

let _logger: ReturnType<typeof Logger.getInstance> | null = null;
const getLogger = () => {
  if (!_logger) {
    _logger = Logger.getInstance().child({ component: "SourceAttribution" });
  }
  return _logger;
};

const toolNameToSource = (name: string): string => {
  const ramLabel = RAM_TOOL_SOURCE_MAP[name];
  const isContextRetriever = CONTEXT_RETRIEVER_PREFIXES.some((prefix) =>
    name.startsWith(prefix),
  );

  let label = "";
  if (ramLabel) {
    label = ramLabel;
  } else if (isContextRetriever) {
    label = "Context Retriever";
  }

  return label;
};

const extractToolNames = (messages: BaseMessage[]): string[] => {
  const names: string[] = [];

  for (const msg of messages) {
    const msgType = msg._getType();
    if (msgType === "tool" && (msg as ToolMessage).name) {
      names.push((msg as ToolMessage).name!);
    }
  }

  return [...new Set(names)];
};

const resolveSourceLabels = (toolNames: string[]): string[] => {
  const labels = toolNames.map(toolNameToSource).filter(Boolean);
  const deduplicated = [...new Set(labels)];

  let result = [DEFAULT_SOURCE];
  if (deduplicated.length > 0) {
    result = deduplicated;
  }

  return result;
};

const buildSourceHeader = (sourceLabels: string[], toolNames: string[]): string => {
  const toolsLine = toolNames.join(", ");

  return `**Source: ${JSON.stringify(sourceLabels)}**\n<tools>${toolsLine}</tools>\n\n`;
};

const findLastAiMessageIndex = (messages: BaseMessage[]): number => {
  let idx = -1;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const isAiMessage = msg._getType() === "ai";
    const hasToolCalls = (msg as AIMessage).tool_calls?.length;
    if (isAiMessage && !hasToolCalls) {
      idx = i;
      break;
    }
  }

  return idx;
};

const injectSourceHeader = (
  messages: BaseMessage[],
  aiMessageIdx: number,
  header: string,
): BaseMessage[] => {
  const lastAi = messages[aiMessageIdx] as AIMessage;
  const originalContent = typeof lastAi.content === "string" ? lastAi.content : "";
  const strippedContent = originalContent
    .replace(/^\*\*Source:.*?\*\*\s*\n?/m, "")
    .replace(/^<tools>.*?<\/tools>\s*\n?/m, "")
    .trimStart();

  const updatedAi = new AIMessage({
    content: header + strippedContent,
    tool_calls: lastAi.tool_calls,
    additional_kwargs: lastAi.additional_kwargs,
  });

  const result = [...messages];
  result[aiMessageIdx] = updatedAi;

  return result;
};

/*
 * Deterministic source attribution: inspects actual ToolMessage objects from the
 * ReAct agent response, maps tool names to source labels, and prepends a structured
 * header to the final AIMessage content.
 *
 * Input messages (from ReAct agent):
 *   [AIMessage(tool_calls), ToolMessage(searchMemoriesBySession), ToolMessage(filter_holding_by_client_id), AIMessage(answer)]
 *
 * Output (final AIMessage content becomes):
 *   **Source: ["RAM Session Memory", "Context Retriever"]**
 *   <tools>searchMemoriesBySession, filter_holding_by_client_id</tools>
 *
 *   James Morrison's current allocation is...
 */
const postProcessMessages = (messages: BaseMessage[]): BaseMessage[] => {
  const logger = getLogger();

  const toolNames = extractToolNames(messages);
  const sourceLabels = resolveSourceLabels(toolNames);
  const header = buildSourceHeader(sourceLabels, toolNames);
  const aiIdx = findLastAiMessageIndex(messages);

  let result = [...messages];
  if (aiIdx < 0) {
    logger.warn("postProcessMessages: no final AIMessage found", {
      messageTypes: messages.map((m) => m._getType()),
    });
  } else {
    result = injectSourceHeader(messages, aiIdx, header);
    logger.info("postProcessMessages: source attribution injected", {
      toolNames,
      sourceLabels,
    });
  }

  return result;
};

export { postProcessMessages };
