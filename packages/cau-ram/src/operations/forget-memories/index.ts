import type { ForgetOptions, ForgetResult } from "../../types";

import { AgentMemory } from "@redis-iris/agent-memory";

import { deleteSessionMemory } from "../session-memory";
import {
  searchAllLongTermMemory,
  deleteLongTermMemories,
} from "../long-term-memory";

const validateOptions = (options: ForgetOptions): void => {
  if (options.includeSession && !options.session?.sessionId) {
    throw new Error("forgetMemories: 'session.sessionId' is required when includeSession is true.");
  }

  if (options.includeLtm) {
    const ltm = options.ltm;
    const hasCriteria = ltm && (ltm.ownerId || ltm.namespace || ltm.topics?.length || ltm.sessionId || ltm.text);

    if (!hasCriteria) {
      throw new Error("forgetMemories: 'ltm' must have at least one criterion (ownerId, namespace, topics, sessionId, or text) when includeLtm is true.");
    }
  }
};

const forgetSessionData = async (
  client: AgentMemory,
  sessionId: string,
): Promise<string[]> => {
  await deleteSessionMemory(client, sessionId);

  return [sessionId];
};

const forgetLtmData = async (
  client: AgentMemory,
  options: ForgetOptions,
): Promise<string[]> => {
  const ltm = options.ltm!;
  const hasText = !!ltm.text;
  const hasFilter = !!(ltm.ownerId || ltm.namespace || ltm.topics?.length || ltm.sessionId);

  const filter = hasFilter
    ? {
        ...(ltm.ownerId ? { ownerId: ltm.ownerId } : {}),
        ...(ltm.namespace ? { namespace: ltm.namespace } : {}),
        ...(ltm.topics?.length ? { topics: ltm.topics } : {}),
        ...(ltm.sessionId ? { sessionId: ltm.sessionId } : {}),
      }
    : undefined;

  const searchResult = await searchAllLongTermMemory(client, {
    text: hasText ? ltm.text : undefined,
    filter,
    similarityThreshold: ltm.similarityThreshold,
  });

  const ids = searchResult.memories.map((m) => m.id);

  let deleted: string[] = [];
  if (ids.length > 0) {
    const deleteResult = await deleteLongTermMemories(client, ids);
    deleted = deleteResult.deleted;
  }

  return deleted;
};

const forgetMemories = async (
  client: AgentMemory,
  options: ForgetOptions,
): Promise<ForgetResult> => {
  validateOptions(options);

  let deletedSessionIds: string[] = [];
  let deletedLtmIds: string[] = [];

  if (options.includeSession) {
    deletedSessionIds = await forgetSessionData(client, options.session!.sessionId);
  }

  if (options.includeLtm) {
    deletedLtmIds = await forgetLtmData(client, options);
  }

  const result: ForgetResult = {
    deletedSessionIds,
    deletedLtmIds,
    totalDeleted: deletedSessionIds.length + deletedLtmIds.length,
  };

  return result;
};

export { forgetMemories };
