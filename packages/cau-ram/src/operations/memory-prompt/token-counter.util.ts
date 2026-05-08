import type { TiktokenModel } from "js-tiktoken";

import { encodingForModel, getEncoding } from "js-tiktoken";

import { PER_MESSAGE_TOKEN_OVERHEAD } from "../../constants";

const CHARS_PER_TOKEN_ESTIMATE = 4;

let encoder: ReturnType<typeof getEncoding> | null = null;

const getEncoder = (modelName?: string) => {
  if (!encoder) {
    try {
      encoder = encodingForModel((modelName as TiktokenModel) ?? "gpt-4o");
    } catch {
      encoder = getEncoding("cl100k_base");
    }
  }

  return encoder;
};

const countTokens = (text: string, modelName?: string): number => {
  let result = 0;

  if (text) {
    try {
      const enc = getEncoder(modelName);
      result = enc.encode(text).length;
    } catch {
      result = Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
    }
  }

  return result;
};

const countMessagesTokens = (
  messages: Array<{ role: string; content: string }>,
  modelName?: string,
): number => {
  let total = 0;
  for (const msg of messages) {
    total += countTokens(`${msg.role}: ${msg.content}`, modelName);
    total += PER_MESSAGE_TOKEN_OVERHEAD;
  }

  return total;
};

export { countTokens, countMessagesTokens, getEncoder };
