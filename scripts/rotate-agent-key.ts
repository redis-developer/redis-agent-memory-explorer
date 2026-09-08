/**
 * Mints a fresh Context Surfaces agent key on the surface already named by
 * CTX_SURFACE_ID and rewrites MCP_AGENT_KEY in .env.
 *
 * Agent keys expire (90 days by default), and an expired key surfaces only as
 * an opaque `MCP tools/list failed (401): Invalid API key`. Rotating in place
 * avoids the alternative of clearing MCP_AGENT_KEY, which sends the backend
 * down the create path and reprovisions a whole new surface plus data import.
 */

import type { AgentKey } from "cau-context-surfaces";

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { ContextSurfaces } from "cau-context-surfaces";

const ENV_FILE_PATH = resolve(process.cwd(), ".env");
const AGENT_KEY_ENV_VAR = "MCP_AGENT_KEY";
const AGENT_KEY_NAME_PREFIX = "chatbot-agent-key";

config({ path: ENV_FILE_PATH });

const assertRequiredEnv = (): { adminKey: string; surfaceId: string } => {
  const adminKey = process.env.CTX_ADMIN_KEY ?? "";
  const surfaceId = process.env.CTX_SURFACE_ID ?? "";

  const isMissing = adminKey === "" || surfaceId === "";
  if (isMissing) {
    throw new Error(
      "CTX_ADMIN_KEY and CTX_SURFACE_ID must both be set in .env to rotate an agent key",
    );
  }

  return { adminKey, surfaceId };
};

const replaceEnvValue = (
  contents: string,
  key: string,
  value: string,
): string => {
  const lines = contents.split("\n");
  const keyPattern = new RegExp(`^\\s*${key}\\s*=`);
  const matchIndex = lines.findIndex((line) => keyPattern.test(line));

  const hasKey = matchIndex !== -1;
  if (hasKey) {
    lines[matchIndex] = `${key}=${value}`;
  } else {
    lines.push(`${key}=${value}`);
  }

  return lines.join("\n");
};

const writeAgentKeyToEnv = (agentKey: string): void => {
  const contents = readFileSync(ENV_FILE_PATH, "utf8");
  const updated = replaceEnvValue(contents, AGENT_KEY_ENV_VAR, agentKey);

  writeFileSync(ENV_FILE_PATH, updated, "utf8");
};

const createKey = async (
  adminKey: string,
  surfaceId: string,
): Promise<AgentKey> => {
  const cs = ContextSurfaces.create({
    adminKey,
    adminApiUrl: process.env.CTX_ADMIN_API_URL || undefined,
    mcpUrl: process.env.CTX_MCP_URL || undefined,
  });

  const created = await cs.createAgentKey(surfaceId, {
    name: `${AGENT_KEY_NAME_PREFIX}-${Date.now()}`,
  });

  return created;
};

const rotateAgentKey = async (): Promise<void> => {
  const { adminKey, surfaceId } = assertRequiredEnv();

  console.log(`Creating agent key on surface ${surfaceId}`);
  const created = await createKey(adminKey, surfaceId);

  writeAgentKeyToEnv(created.key);

  console.log(`Wrote ${AGENT_KEY_ENV_VAR} to .env`);
  console.log(`  name:      ${created.name}`);
  console.log(`  expiresAt: ${created.expiresAt ?? "never"}`);
  console.log("Restart the stack to pick up the new key.");
};

rotateAgentKey().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
