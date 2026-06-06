import type { BaseMessage } from "@langchain/core/messages";

import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { Logger } from "cau-logger";

import { ENV } from "../config";
import { MessageType, RoleLabel } from "../constants";
import { QUERY_NORMALIZER_PROMPT } from "./query-normalizer-prompt";

type SessionContext = {
  sessionId: string;
  userId: string;
  namespace: string;
  meetingContext: string;
  participants: string;
};

let _logger: ReturnType<typeof Logger.getInstance> | null = null;
const getLogger = () => {
  if (!_logger) {
    _logger = Logger.getInstance().child({ component: "QueryNormalizer" });
  }
  return _logger;
};

const HISTORY_TURN_LIMIT = 8;

const messageText = (message: BaseMessage): string => {
  const { content } = message;

  let text = "";
  if (typeof content === "string") {
    text = content;
  } else {
    text = content
      .map((part) =>
        typeof part === "string" ? part : "text" in part ? (part.text ?? "") : "",
      )
      .join(" ")
      .trim();
  }

  return text;
};

const roleLabel = (message: BaseMessage): string => {
  const type = message._getType();

  let label: string = type;
  if (type === MessageType.HUMAN) {
    label = RoleLabel.USER;
  } else if (type === MessageType.AI) {
    label = RoleLabel.ASSISTANT;
  }

  return label;
};

const getLastHumanText = (messages: BaseMessage[]): string => {
  let text = "";

  for (let i = messages.length - 1; i >= 0; i--) {
    const isHuman = messages[i]._getType() === MessageType.HUMAN;
    if (isHuman) {
      text = messageText(messages[i]);
      break;
    }
  }

  return text;
};

const buildHistoryBlock = (messages: BaseMessage[]): string => {
  const recent = messages.slice(-HISTORY_TURN_LIMIT);

  return recent
    .filter(
      (m) => m._getType() === MessageType.HUMAN || m._getType() === MessageType.AI,
    )
    .map((m) => `${roleLabel(m)}: ${messageText(m)}`)
    .join("\n");
};

const buildUserInput = (
  messages: BaseMessage[],
  sessionContext: SessionContext,
): string => {
  const history = buildHistoryBlock(messages);
  const rawQuestion = getLastHumanText(messages);
  const meeting = sessionContext.meetingContext || "No active meeting session.";
  const participants = sessionContext.participants || "Unknown participants.";

  return [
    "Conversation history:",
    history || "(no prior turns)",
    "",
    "Session context:",
    `- Active meeting: ${meeting}`,
    `- Participants: ${participants}`,
    "",
    `Latest user question: "${rawQuestion}"`,
    "",
    "Rewrite the latest user question as a fully standalone question.",
  ].join("\n");
};

/*
 * Rewrites the latest user question into a fully self-contained standalone
 * question used as the semantic-cache key. Always invoked (no first-turn
 * shortcut). Throws on failure so the caller can run the agent on raw text and
 * disable caching for that turn.
 */
const toStandaloneQuestion = async (
  messages: BaseMessage[],
  sessionContext: SessionContext,
): Promise<string> => {
  const logger = getLogger();
  const model = ENV.CHATBOT_MODEL;
  const rawQuestion = getLastHumanText(messages);

  const llm = new ChatOpenAI({
    model,
    temperature: 0,
    maxTokens: ENV.LANGCACHE_NORMALIZE_MAX_TOKENS,
    apiKey: ENV.OPENAI_API_KEY,
  });

  const userInput = buildUserInput(messages, sessionContext);

  const startMs = Date.now();
  const result = await llm.invoke([
    new SystemMessage(QUERY_NORMALIZER_PROMPT),
    new HumanMessage(userInput),
  ]);

  const standalone = messageText(result).trim();

  if (!standalone) {
    throw new Error("Normalizer returned an empty standalone question");
  }

  logger.info("Query normalized", {
    model,
    sessionId: sessionContext.sessionId,
    meetingContext: sessionContext.meetingContext,
    raw: rawQuestion,
    standalone,
    latencyMs: Date.now() - startMs,
  });

  return standalone;
};

export { toStandaloneQuestion };

export type { SessionContext };
