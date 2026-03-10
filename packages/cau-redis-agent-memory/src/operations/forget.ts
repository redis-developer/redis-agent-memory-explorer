import type { MemoryAPIClient } from "agent-memory-client";
import type { ForgetPolicy, ForgetOptions, ForgetResult } from "../types";

const forgetLongTermMemoriesOp = async (
  client: MemoryAPIClient,
  policy: ForgetPolicy,
  options?: ForgetOptions,
): Promise<ForgetResult> => {
  const response = await client.forgetLongTermMemories({
    policy: {
      max_age_days: policy.maxAgeDays,
      max_inactive_days: policy.maxInactiveDays,
      budget: policy.budget,
      memory_type_allowlist: policy.memoryTypeAllowlist,
    },
    namespace: options?.namespace,
    userId: options?.userId,
    sessionId: options?.sessionId,
    limit: options?.limit,
    dryRun: options?.dryRun,
    pinnedIds: options?.pinnedIds,
  });

  return {
    deleted: response.deleted,
    scanned: response.scanned,
    deletedIds: response.deleted_ids,
  };
};

export { forgetLongTermMemoriesOp };
