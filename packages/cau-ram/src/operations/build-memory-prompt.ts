import type {
  BuildMemoryPromptOptions,
  MemoryPromptResult,
  MemorySearchResult,
  SimpleMessage,
  MemorySearchOptions,
  MemoryRecord,
  LlmConfig,
} from "../types";

import { AgentMemory } from "@redis-ai/agent-memory";

import {
  FORMATTING_OVERHEAD_TOKENS,
  DEFAULT_LTM_PROMPT_LIMIT,
  PER_MESSAGE_TOKEN_OVERHEAD,
} from "../constants";
import { getSessionMemory } from "./session-memory";
import { searchLongTermMemory } from "./long-term-memory";
import {
  countTokens,
  countMessagesTokens,
} from "../helpers/token-counter.util";
import { getEffectiveTokenLimit } from "../helpers/model-limits.util";
import { summarizeMessages } from "../helpers/summarize-messages.util";

const buildLtmSearchOptions = (
  options: BuildMemoryPromptOptions,
): MemorySearchOptions | null => {
  const isDisabled = options.longTermSearch === false;
  const isCustom = typeof options.longTermSearch === "object";

  let result: MemorySearchOptions | null = null;

  if (!isDisabled && isCustom) {
    const custom = options.longTermSearch as MemorySearchOptions;
    result = {
      text: custom.text ?? options.query,
      filter: {
        ...custom.filter,
        ownerId: custom.filter?.ownerId ?? options.ownerId,
        namespace: custom.filter?.namespace ?? options.namespace,
      },
      filterOp: custom.filterOp,
      limit: custom.limit ?? DEFAULT_LTM_PROMPT_LIMIT,
      similarityThreshold: custom.similarityThreshold,
    };
  } else if (!isDisabled) {
    const hasOwner = !!options.ownerId;
    const hasNamespace = !!options.namespace;
    const needsFilter = hasOwner || hasNamespace;

    let filter = undefined;
    if (needsFilter) {
      filter = {
        ...(hasOwner ? { ownerId: options.ownerId } : {}),
        ...(hasNamespace ? { namespace: options.namespace } : {}),
      };
    }

    result = {
      text: options.query,
      limit: DEFAULT_LTM_PROMPT_LIMIT,
      filter,
    };
  }

  return result;
};

/**
 * Example output:
 * ## Long-Term Memory
 * - [episodic, coding] User prefers TypeScript over JavaScript
 * - [semantic] Project uses npm workspaces monorepo structure
 */
const formatLtmBlock = (memories: MemoryRecord[]): string => {
  const isEmpty = memories.length === 0;

  let result = "";
  if (!isEmpty) {
    const lines = memories.map((m) => {
      const meta = [m.memoryType, ...(m.topics ?? [])]
        .filter(Boolean)
        .join(", ");
      const prefix = meta ? `[${meta}] ` : "";
      return `- ${prefix}${m.text}`;
    });
    result = `## Long-Term Memory\n${lines.join("\n")}`;
  }

  return result;
};

/**
 * Example output (with summary + recent events):
 * ## Session Summary
 * User discussed project setup and chose Redis for caching.
 *
 * ## Recent Conversation
 * USER: What about vector search?
 * ASSISTANT: Redis supports vector similarity search via RediSearch.
 *
 */
const formatSessionBlock = (
  summary: string | undefined,
  recentEvents: SimpleMessage[],
): string => {
  const parts: string[] = [];

  if (summary) {
    parts.push(`## Session Summary\n${summary}`);
  }

  if (recentEvents.length > 0) {
    const lines = recentEvents.map((e) => `${e.role}: ${e.content}`);
    parts.push(`## Recent Conversation\n${lines.join("\n")}`);
  }

  return parts.join("\n\n");
};

const trimMessagesFromEnd = (
  messages: SimpleMessage[],
  budget: number,
  modelName?: string,
): SimpleMessage[] => {
  let totalTokens = 0;
  const result: SimpleMessage[] = [];

  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens =
      countTokens(`${messages[i].role}: ${messages[i].content}`, modelName) +
      PER_MESSAGE_TOKEN_OVERHEAD;
    const wouldExceed = totalTokens + msgTokens > budget;
    if (wouldExceed) {
      break;
    }
    totalTokens += msgTokens;
    result.push(messages[i]);
  }

  return result.reverse();
};

const fetchSessionAndLtm = async (
  client: AgentMemory,
  options: BuildMemoryPromptOptions,
) => {
  const ltmSearchOpts = buildLtmSearchOptions(options);

  let session = null;
  let ltmResult: MemorySearchResult = { memories: [] };

  try {
    if (options.sessionId) {
      session = await getSessionMemory(client, options.sessionId);
    }

    if (ltmSearchOpts) {
      ltmResult = await searchLongTermMemory(client, ltmSearchOpts);
    }
  } catch (err) {
    console.error("Error fetching session and LTM", err);
  }

  return [session, ltmResult] as const;
};

const resolveSessionEvents = async (
  allMessages: SimpleMessage[],
  sessionBudget: number,
  modelName: string | undefined,
  llmConfig: LlmConfig | undefined,
): Promise<{ summary?: string; events: SimpleMessage[] }> => {
  const totalSessionTokens = countMessagesTokens(allMessages, modelName);
  const fitsInBudget = totalSessionTokens <= sessionBudget;

  let summary: string | undefined;
  let events: SimpleMessage[];

  if (fitsInBudget) {
    summary = undefined;
    events = allMessages;
  } else if (!llmConfig) {
    summary = undefined;
    events = trimMessagesFromEnd(allMessages, sessionBudget, modelName);
  } else {
    summary = await summarizeMessages(allMessages, llmConfig, sessionBudget);
    events = [];
  }

  return { summary, events };
};

const buildMemoryPrompt = async (
  client: AgentMemory,
  llmConfig: LlmConfig | undefined,
  options: BuildMemoryPromptOptions,
): Promise<MemoryPromptResult> => {
  const budget = getEffectiveTokenLimit(
    options.modelName,
    options.contextWindowMax,
  );
  const [session, ltmResult] = await fetchSessionAndLtm(client, options);

  const ltmMemories = ltmResult.memories;
  const ltmBlock = formatLtmBlock(ltmMemories);
  const queryTokens = countTokens(options.query, options.modelName);
  const ltmTokens = countTokens(ltmBlock, options.modelName);
  const fixedTokens = queryTokens + ltmTokens + FORMATTING_OVERHEAD_TOKENS;
  const sessionBudget = budget - fixedTokens;

  let sessionSummary: string | undefined;
  let recentSessionEvents: SimpleMessage[] = [];

  const hasSessionEvents = !!session && session.events.length > 0;
  if (hasSessionEvents) {
    const allMessages: SimpleMessage[] = session!.events.map((e) => ({
      role: e.role,
      content: e.content,
    }));

    const resolved = await resolveSessionEvents(
      allMessages,
      sessionBudget,
      options.modelName,
      llmConfig,
    );
    sessionSummary = resolved.summary;
    recentSessionEvents = resolved.events;
  }

  const contextParts: string[] = [];
  if (ltmBlock) {
    contextParts.push(ltmBlock);
  }
  const sessionBlock = formatSessionBlock(sessionSummary, recentSessionEvents);
  if (sessionBlock) {
    contextParts.push(sessionBlock);
  }

  const context = contextParts.join("\n\n");
  const usedTokens = countTokens(context, options.modelName) + queryTokens;

  const longTermMemories = ltmMemories.map((m) => ({
    id: m.id,
    text: m.text,
    memoryType: m.memoryType,
    topics: m.topics,
  }));

  return {
    context,
    sessionSummary,
    recentSessionEvents,
    longTermMemories,
    tokenUsage: {
      budget,
      used: usedTokens,
    },
  };
};

export { buildMemoryPrompt };
