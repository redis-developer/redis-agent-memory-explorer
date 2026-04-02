import type { TranscriptChunk } from "../types";

import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

import { QUERY_EXTRACTION_MODEL, QUERY_EXTRACTION_MAX_TOKENS } from "../constants";
import { ENV } from "../config";
import { QUERY_EXTRACTION_PROMPT } from "./query-extraction-prompt";

const extractSearchQuery = async (recentChunks: TranscriptChunk[]): Promise<string> => {
  const llm = new ChatOpenAI({
    model: QUERY_EXTRACTION_MODEL,
    temperature: 0,
    maxTokens: QUERY_EXTRACTION_MAX_TOKENS,
    apiKey: ENV.OPENAI_API_KEY,
  });

  const chunksText = recentChunks
    .map((c) => `${c.speaker}: ${c.text}`)
    .join("\n");

  const result = await llm.invoke([
    new SystemMessage(QUERY_EXTRACTION_PROMPT),
    new HumanMessage(chunksText),
  ]);

  return result.content as string;
};

export { extractSearchQuery };
