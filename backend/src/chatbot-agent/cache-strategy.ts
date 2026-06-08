import type { BaseMessage } from "@langchain/core/messages";
import type { CopilotKitState, DatasetConfig } from "../types";
import type { SessionContext } from "./query-normalizer";
import type { CacheScope } from "../services/chatbot-cache.service";

import { AIMessage } from "@langchain/core/messages";
import { Logger } from "cau-logger";

import { toStandaloneQuestion } from "./query-normalizer";
import { TranscriptLoaderService } from "../services/transcript-loader.service";
import { ChatbotCacheService } from "../services/chatbot-cache.service";
import { ENV } from "../config";
import { SESSION_ID_PATTERN } from "../constants";

// Everything needed to (a) serve a cache hit and (b) write the answer back after
// the agent runs. `lookup` produces it; `store` consumes it.
type CacheTurn = {
  hit: AIMessage | null;
  cacheUsable: boolean;
  standalone: string;
  scope: CacheScope;
  rawQuestion: string;
};

let _logger: ReturnType<typeof Logger.getInstance> | null = null;
const getLogger = () => {
  if (!_logger) {
    _logger = Logger.getInstance().child({ component: "ChatbotCacheStrategy" });
  }
  return _logger;
};

// Frontend registers these readables (matched case-insensitively as substrings
// of the CopilotKit readable description -- see frontend/src/app/page.tsx).
const READABLE_SESSION_ID = "active session id";
const READABLE_USER_ID = "user id for memory scoping";
const READABLE_BYPASS_CACHE = "bypass semantic cache";

// CopilotKit serializes readable values as JSON, so a string value arrives
// wrapped in quotes (e.g. `"playback-..."`). Decode it back to the raw string.
const decodeReadableValue = (value: string | undefined): string | undefined => {
  let result = value;

  if (value !== undefined) {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === "string") {
        result = parsed;
      }
    } catch {
      // Not JSON-encoded; keep the raw string.
    }
  }

  return result;
};

const findReadableValue = (
  copilotkit: CopilotKitState,
  descriptionNeedle: string,
): string | undefined => {
  const readables = copilotkit?.context ?? [];
  const match = readables.find((r) =>
    r.description.toLowerCase().includes(descriptionNeedle),
  );

  return decodeReadableValue(match?.value);
};

// Meeting metadata is read-only and static per transcript, so memoize it
// in-process to avoid re-reading the file every turn.
const meetingContextCache = new Map<
  string,
  { meetingContext: string; participants: string }
>();

const deriveMeetingContext = (
  sessionId: string,
  datasetConfig: DatasetConfig,
): { meetingContext: string; participants: string } => {
  const logger = getLogger();
  let result = { meetingContext: "", participants: "" };

  const hasSession = sessionId !== "" && sessionId !== "none";
  let transcriptId: string | undefined;
  if (hasSession) {
    const match = SESSION_ID_PATTERN.exec(sessionId);
    transcriptId = match?.[1];
  }

  let cached: { meetingContext: string; participants: string } | undefined;
  if (transcriptId) {
    cached = meetingContextCache.get(transcriptId);
  }

  if (cached) {
    result = cached;
  } else if (transcriptId) {
    try {
      const { meeting } = TranscriptLoaderService.loadTranscript(
        ENV.ACTIVE_DATASET,
        transcriptId,
      );

      const participants = Object.entries(meeting.participants)
        .map(([roleKey, name]) => {
          const label = datasetConfig.roles?.[roleKey]?.shortLabel ?? roleKey;
          return `${name} (${label})`;
        })
        .join(", ");

      const meetingContext = `${meeting.date} ${meeting.type} meeting`;
      result = { meetingContext, participants };
      meetingContextCache.set(transcriptId, result);
    } catch (error) {
      logger.warn("Failed to derive meeting context", {
        transcriptId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
};

const getLastHumanText = (messages: BaseMessage[]): string => {
  let result = "";

  for (let i = messages.length - 1; i >= 0; i--) {
    const isHuman = messages[i]._getType() === "human";
    if (isHuman) {
      const { content } = messages[i];
      if (typeof content === "string") {
        result = content;
      }
      break;
    }
  }

  return result;
};

const extractFinalText = (messages: BaseMessage[]): string => {
  let result = "";

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const isAi = msg._getType() === "ai";
    const hasToolCalls = (msg as AIMessage).tool_calls?.length;
    if (isAi && !hasToolCalls) {
      const { content } = msg;
      if (typeof content === "string") {
        result = content;
      }
      break;
    }
  }

  return result;
};

/*
 * Normalizes the user's question, then (unless bypassed/disabled) checks the
 * semantic cache. Returns a `CacheTurn`: `hit` is a ready-to-serve AIMessage on
 * a cache hit, otherwise null. The rest of the turn is the handle `store` needs
 * to write the fresh answer back. Never throws -- a failed normalization just
 * disables caching for this turn.
 */
const lookup = async (
  copilotkit: CopilotKitState,
  messages: BaseMessage[],
  datasetConfig: DatasetConfig,
): Promise<CacheTurn> => {
  const logger = getLogger();
  const userId =
    findReadableValue(copilotkit, READABLE_USER_ID) ?? datasetConfig.userId;
  const scope: CacheScope = { userId, namespace: ENV.ACTIVE_DATASET };
  const rawQuestion = getLastHumanText(messages);

  let turn: CacheTurn = {
    hit: null,
    cacheUsable: false,
    standalone: "",
    scope,
    rawQuestion,
  };

  if (ENV.LANGCACHE_ENABLED) {
    const sessionId =
      findReadableValue(copilotkit, READABLE_SESSION_ID) ?? "none";
    const bypassCache =
      findReadableValue(copilotkit, READABLE_BYPASS_CACHE) ?? "false";

    const { meetingContext, participants } = deriveMeetingContext(
      sessionId,
      datasetConfig,
    );

    const sessionContext: SessionContext = {
      sessionId,
      userId,
      namespace: ENV.ACTIVE_DATASET,
      meetingContext,
      participants,
    };

    let cacheUsable = false;
    let standalone = "";
    try {
      standalone = await toStandaloneQuestion(messages, sessionContext);
      cacheUsable = true;
    } catch (error) {
      logger.warn(
        "Query normalization failed -- running agent on raw text, caching disabled this turn",
        { error: error instanceof Error ? error.message : String(error) },
      );
    }

    let hit: AIMessage | null = null;
    const isBypass = bypassCache === "true";
    const canRead = cacheUsable && !isBypass;
    if (canRead) {
      const cached = await ChatbotCacheService.getCachedAnswer(
        standalone,
        scope,
      );
      if (cached) {
        const similarity = Math.round(cached.similarity * 100);
        // Keep the badge a single parseable line: strip `**`/newlines from the
        // matched prompt so it can't break the frontend's `**Cache: ...**` regex.
        const matched = cached.matchedPrompt
          .replace(/\*\*/g, "")
          .replace(/[\r\n]+/g, " ")
          .trim();
        const matchedSegment = matched ? ` | matched: ${matched}` : "";
        const badged = `**Cache: LangCache | similarity: ${similarity}%${matchedSegment}**\n${cached.text}`;
        logger.info("Serving response from LangCache", {
          similarity,
          standalone,
          matchedPrompt: cached.matchedPrompt,
        });
        hit = new AIMessage(badged);
      }
    }

    turn = { hit, cacheUsable, standalone, scope, rawQuestion };
  }

  return turn;
};

/*
 * Writes the agent's fresh answer back to the cache, keyed by the normalized
 * standalone question from `lookup`. No-op when caching was not usable this turn.
 */
const store = async (
  turn: CacheTurn,
  messages: BaseMessage[],
): Promise<void> => {
  if (turn.cacheUsable) {
    const finalText = extractFinalText(messages);
    await ChatbotCacheService.cacheAnswer(
      turn.standalone,
      finalText,
      turn.scope,
      turn.rawQuestion,
    );
  }
};

const ChatbotCacheStrategy = {
  lookup,
  store,
};

export { ChatbotCacheStrategy };

export type { CacheTurn };
