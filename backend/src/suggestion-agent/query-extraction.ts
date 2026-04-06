import type { TranscriptChunk } from "../types";

import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { Logger } from "cau-logger";

import { QUERY_EXTRACTION_MAX_TOKENS } from "../constants";
import { ENV } from "../config";
import { QUERY_EXTRACTION_PROMPT } from "./query-extraction-prompt";

let _logger: ReturnType<typeof Logger.getInstance> | null = null;
const getLogger = () => {
  if (!_logger) _logger = Logger.getInstance().child({ component: "QueryExtraction" });
  return _logger;
};

const extractSearchQuery = async (recentChunks: TranscriptChunk[]): Promise<string> => {
  const logger = getLogger();
  const llm = new ChatOpenAI({
    model: ENV.QUERY_EXTRACTION_MODEL,
    temperature: 0,
    maxTokens: QUERY_EXTRACTION_MAX_TOKENS,
    apiKey: ENV.OPENAI_API_KEY,
  });

  const chunksText = recentChunks
    .map((c) => `${c.speaker}: ${c.text}`)
    .join("\n");

  logger.debug("Extracting search query from chunks", {
    model: ENV.QUERY_EXTRACTION_MODEL,
    chunkCount: recentChunks.length,
    inputLength: chunksText.length,
  });

  const startMs = Date.now();
  const result = await llm.invoke([
    new SystemMessage(QUERY_EXTRACTION_PROMPT),
    new HumanMessage(chunksText),
  ]);
  const extracted = result.content as string;

  logger.info("Search query extracted", {
    query: extracted,
    latencyMs: Date.now() - startMs,
  });

  return extracted;
};

export { extractSearchQuery };
