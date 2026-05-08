import type { LlmConfig, SimpleMessage } from "../../types";

import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const SUMMARIZE_BASE_PROMPT = "You are a conversation summarizer. Given a list of conversation messages, produce a concise summary that captures all key facts, decisions, preferences, and action items. Do not add information that was not in the conversation.";

const buildSystemPrompt = (maxTokens?: number): string => {
  const suffix = maxTokens
    ? `Keep the summary under ${maxTokens} tokens.`
    : "Keep it brief but complete.";

  return `${SUMMARIZE_BASE_PROMPT} ${suffix}`;
};

const buildLlm = (config: LlmConfig): ChatOpenAI => {
  return new ChatOpenAI({
    modelName: config.model,
    openAIApiKey: config.apiKey,
    temperature: 0,
  });
};

const formatMessagesForSummary = (messages: SimpleMessage[]): string => {
  return messages.map((m) => `${m.role}: ${m.content}`).join("\n");
};

const summarizeMessages = async (
  messages: SimpleMessage[],
  llmConfig: LlmConfig,
  maxTokens?: number,
): Promise<string> => {
  const isEmpty = messages.length === 0;

  let result = "";
  if (!isEmpty) {
    const llm = buildLlm(llmConfig);
    const formatted = formatMessagesForSummary(messages);
    const systemPrompt = buildSystemPrompt(maxTokens);

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(`Summarize this conversation:\n\n${formatted}`),
    ]);

    const content = response.content;
    result = typeof content === "string" ? content : String(content);
  }

  return result;
};

export { summarizeMessages, formatMessagesForSummary };
