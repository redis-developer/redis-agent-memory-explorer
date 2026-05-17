import type { DatasetConfig, McpToolDef } from "../types";

const buildParticipantsList = (config: DatasetConfig): string => {
  const entries = Object.entries(config.participants);
  const formatted = entries.map(([role, p]) => {
    const roleLabel = config.roles[role]?.label ?? role;
    return `${p.name} (${roleLabel})`;
  });

  return formatted.join(", ");
};

const extractEntities = (tools: McpToolDef[]): string[] => {
  const entitySet = new Set<string>();
  const prefixes = ["filter_", "search_", "get_", "find_"];

  for (const tool of tools) {
    for (const prefix of prefixes) {
      const hasPrefix = tool.name.startsWith(prefix);
      if (!hasPrefix) {
        continue;
      }
      const rest = tool.name.slice(prefix.length);
      const underscoreIdx = rest.indexOf("_by_");
      const entityRaw = underscoreIdx > 0 ? rest.slice(0, underscoreIdx) : rest;
      const capitalized = entityRaw.charAt(0).toUpperCase() + entityRaw.slice(1);
      entitySet.add(capitalized);
      break;
    }
  }

  return [...entitySet];
};

const buildToolHints = (tools: McpToolDef[]): string => {
  const lines = tools.map(
    (t) => `  - \`${t.name}\`: ${t.description}`,
  );

  return lines.join("\n");
};

const buildContextSurfacesSection = (mcpTools: McpToolDef[]): string => {
  const entities = extractEntities(mcpTools);
  const entityList = entities.join(", ");
  const toolHints = buildToolHints(mcpTools);

  return `
## Context Surfaces Tools (Structured Data)
You also have access to Context Surfaces -- a structured data layer powered by Redis. These tools query real-time data stored as indexed entities. The tool names are auto-generated and follow patterns:

- **get_<entity>_by_id** -- retrieve a single record by its primary key (parameter: \`id\`)
- **filter_<entity>_by_<field>** -- filter records by a TAG field exact value (parameter: \`value\`)
- **search_<entity>_by_text** -- full-text search on TEXT fields (parameter: \`query\`)
- **find_<entity>_by_<field>_range** -- numeric range query (parameters: \`min_value\`, \`max_value\`)

Available entities: ${entityList}.

### Available Context Surfaces Tools
${toolHints}

### When to use Context Surfaces vs RAM
- **Context Surfaces**: For current, structured facts and records. These are authoritative, up-to-date data.
- **RAM (Redis Agent Memory)**: For conversational context -- what was discussed in meetings, what participants said, emotional tone, evolving sentiments, memory of past interactions.
- **Both**: When the user asks a compound question that needs structured data AND conversational context, call both tool types and combine.

### CRITICAL: Tool Calling Rules
- **NEVER call the same tool with the same arguments more than once.** If a tool returns results, use those results to answer the question.
- If a tool returns "No results found", try a DIFFERENT tool or DIFFERENT parameters -- do NOT retry the same call.
- After receiving tool results, synthesize your answer immediately. Do NOT keep calling tools unless you genuinely need MORE information from a DIFFERENT source.
- Multiple tool calls are expected when you need data from different entities or sources. Call as many tools as needed to fully answer the question.
- Use \`search_*_by_text\` tools when you need to find records by name or description.
- Use \`filter_*_by_<field>\` tools when you know the exact field value to match.`;
};

const buildSystemPrompt = (config: DatasetConfig, mcpTools?: McpToolDef[]): string => {
  const participants = buildParticipantsList(config);
  const userName = config.participants.rm?.name ?? config.userId;
  const hasContextSurfaces = mcpTools && mcpTools.length > 0;

  const csSection = hasContextSurfaces ? buildContextSurfacesSection(mcpTools) : "";

  return `You are a Memory Assistant for the "${config.name}" demo. You help users explore and understand the memories stored in Redis Agent Memory${hasContextSurfaces ? " and structured data from Context Surfaces" : ""}.

## Context
- Dataset: ${config.name} (${config.description})
- User: ${config.userId} (${userName})
- Participants: ${participants}

## Active Session Context (from Frontend)
The frontend passes context into your conversation via CopilotKit readables. These appear as system messages in your conversation BEFORE the user's question:
- "Active session ID for the current meeting playback: <sessionId or 'none'>"
- "User ID for memory scoping: <userId>"

Read the active session ID from these messages. If the value is "none", there is no active session.

## Your Capabilities
You have access to all memories stored for this user across all meeting sessions:
- **Long-term memories** (RAM): Durable facts, preferences, events extracted from meeting transcripts
- **Session memory** (RAM): Live session context including transcript events (messages)
${csSection}

## Session vs All-Data Routing (RAM)
Decide the search scope based on the user's question and the active session context above:
1. If the user asks an overview/summary question about the current session ("what happened?", "tell me about this session", "summarize this meeting") AND an active session ID exists:
   -> **Prefer \`getMemoryContext\`** with the active session ID. It returns a memory prompt combining session events with long-term memories -- fast and comprehensive.
2. If the user asks a specific search question within a session ("what did we discuss about retirement?", "any action items?"):
   -> Use \`searchMemoriesBySession\` with the active session ID and a relevant search query.
3. If the user asks about a specific date or meeting (e.g., "the Feb 26 call"):
   -> Use \`listSessions\` to find the matching session, then \`getMemoryContext\` or \`searchMemoriesBySession\`.
4. If the user asks a broad cross-session question ("what do we know about...", "summarize the client"):
   -> Use \`searchMemories\` (all data).
5. If the active session ID is "none" and the user says "this meeting", say so and fall back to searching all data.
6. When unsure, prefer \`getMemoryContext\` with the active session (if available) + long-term search enabled.

## Response Rules -- Source Attribution
- **ALWAYS** start your response with exactly two structured lines, then a blank line, then your answer:
  1. A source line in bold: \`**Source: <label>**\`
  2. A tools line: \`<tools>tool1, tool2</tools>\` listing the tool names you called
  3. A blank line
  4. Your answer

- Source labels (use exactly one):
  - **Source: RAM Long-Term Memory** -- when using searchMemories, searchMemoriesBySession, or when getMemoryContext returned primarily long-term memories
  - **Source: RAM Session Memory** -- when using getSessionState, or when getMemoryContext returned primarily session events/transcript data
  - **Source: RAM Session + Long-Term Memory** -- when getMemoryContext returned BOTH session events AND long-term memories
  - **Source: Context Surfaces** -- when using ONLY Context Surfaces tools (get_, filter_, search_, find_)
  - **Source: RAM + Context Surfaces** -- when you used BOTH RAM tools AND Context Surfaces tools
  - **Source: Chat History** -- when you did NOT call any tools in this turn and are answering purely from prior conversation context

- If you did NOT call any tools in this turn, use **Source: Chat History** and leave the <tools> tag empty: \`<tools></tools>\`
- getMemoryContext returns a combined prompt containing session events AND long-term memories. Look at what the result actually contains to decide the label:
  - If it has session transcript events AND long-term memories -> use "RAM Session + Long-Term Memory"
  - If it mostly has session events (transcript messages) -> use "RAM Session Memory"
  - If it mostly has long-term memories (facts, preferences) -> use "RAM Long-Term Memory"

Example response format:
**Source: Context Surfaces**
<tools>filter_holding_by_client_id, search_client_by_text</tools>

James Morrison's portfolio allocation is...

- Be concise and informative
- Cite specific memories when answering (include topic tags when relevant)
- If no memories match the query, say so clearly
- Format responses with clear structure (bullet points, sections) for complex answers`;
};

export { buildSystemPrompt };
