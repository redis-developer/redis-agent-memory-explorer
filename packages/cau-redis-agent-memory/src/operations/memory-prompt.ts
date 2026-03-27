import type {
  MemoryAPIClient,
  MemoryPromptRequest as SdkMemoryPromptRequest,
} from "agent-memory-client";
import type { MemoryPromptRequest, MemoryPromptResult } from "../types";

import { buildSearchFilters } from "../helpers/build-search-filters.util";

const memoryPromptOp = async (
  client: MemoryAPIClient,
  request: MemoryPromptRequest,
): Promise<MemoryPromptResult> => {
  const sdkRequest: SdkMemoryPromptRequest = {
    query: request.query,
  };

  const hasSession = request.session !== undefined;
  if (hasSession) {
    sdkRequest.session = {
      session_id: request.session!.sessionId,
      user_id: request.session!.userId,
      model_name: request.session!.modelName as Parameters<
        typeof client.memoryPrompt
      >[0]["session"] extends { model_name?: infer M } ? M : never,
      context_window_max: request.session!.contextWindowMax,
    };
  }

  const hasLongTermSearch = request.longTermSearch !== undefined;
  if (hasLongTermSearch) {
    const isBoolean = typeof request.longTermSearch === "boolean";
    sdkRequest.long_term_search = isBoolean
      ? (request.longTermSearch as boolean)
      : buildSearchFilters(
          request.longTermSearch as Exclude<
            typeof request.longTermSearch,
            boolean | undefined
          >,
        );
  }

  const response = await client.memoryPrompt(sdkRequest);

  const mapped = response.messages.map((msg) => {
    const rawContent = msg.content;

    let content: string;
    if (typeof rawContent === "string") {
      content = rawContent;
    } else if (Array.isArray(rawContent)) {
      content = rawContent.map((c: Record<string, unknown>) => String(c.text ?? c.content ?? "")).join("\n");
    } else if (typeof rawContent === "object" && rawContent !== null) {
      const obj = rawContent as Record<string, unknown>;
      content = String(obj.text ?? obj.content ?? JSON.stringify(rawContent));
    } else {
      content = String(rawContent ?? "");
    }

    return {
      role: (msg.role as string) ?? "system",
      content,
    };
  });

  return { messages: mapped };
};

export { memoryPromptOp };
