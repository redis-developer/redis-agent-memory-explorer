/**
 * Full lifecycle usage example for cau-context-surfaces.
 *
 * Demonstrates: schema definition -> surface creation -> data loading ->
 * MCP tool listing -> tool calls -> cross-entity queries -> cleanup.
 *
 * Run: npx tsx examples/usage-example.ts
 * Requires: CTX_ADMIN_KEY, CTX_ADMIN_API_URL, CTX_MCP_URL, REDIS_URL in .env
 *
 * ─── Tool Generation Rules (verified against live API) ──────────────────────
 *
 * Context Surfaces auto-generates MCP tools per entity based on indexed fields.
 * Tools are entity-specific, NOT generic. Each tool targets one entity + one
 * field (or field type). There is no combined multi-field filter tool -- an AI
 * agent composes multiple single-field tool calls to answer complex queries.
 *
 *  Index Type  │ Tool Pattern                              │ Input (required)
 * ─────────────┼───────────────────────────────────────────┼──────────────────────────
 *  (always)    │ get_{entity}_by_id                        │ { id: string }
 *  TEXT        │ search_{entity}_by_text                   │ { query: string }
 *  TAG         │ filter_{entity}_by_{field}                │ { value: string }
 *  NUMERIC     │ find_{entity}_by_{field}_range            │ { min_value, max_value }
 *
 * All filter/search/find tools also accept optional { limit: number, offset: number }.
 *
 * ─── Generated Tools for This Schema (5 entities, 32 tools) ────────────────
 *
 *  Entity         │ get (1 per entity)    │ search (TEXT)            │ filter (TAG)                    │ find (NUMERIC range)
 * ────────────────┼───────────────────────┼──────────────────────────┼─────────────────────────────────┼──────────────────────────────────
 *  Client         │ get_client_by_id      │ search_client_by_text   │ filter_client_by_organization   │ find_client_by_age_range
 *                 │                       │  (searches: name)       │ filter_client_by_risk_profile   │ find_client_by_total_aum_range
 *                 │                       │                         │                                 │
 *  Holding        │ get_holding_by_id     │ (none -- no text field) │ filter_holding_by_client_id     │ find_holding_by_allocation_percent_range
 *                 │                       │                         │ filter_holding_by_asset_class   │ find_holding_by_current_value_range
 *                 │                       │                         │                                 │
 *  FinancialGoal  │ get_financialgoal_    │ search_financialgoal_   │ filter_financialgoal_by_        │ find_financialgoal_by_target_amount_range
 *                 │   by_id              │   by_text               │   client_id                     │ find_financialgoal_by_target_year_range
 *                 │                       │  (searches: description)│ filter_financialgoal_by_type    │
 *                 │                       │                         │ filter_financialgoal_by_status  │
 *                 │                       │                         │                                 │
 *  Meeting        │ get_meeting_by_id     │ search_meeting_by_text  │ filter_meeting_by_client_id     │ find_meeting_by_duration_minutes_range
 *                 │                       │  (searches: summary,    │ filter_meeting_by_date          │
 *                 │                       │   key_decisions)        │ filter_meeting_by_type          │
 *                 │                       │                         │ filter_meeting_by_sentiment     │
 *                 │                       │                         │                                 │
 *  ActionItem     │ get_actionitem_by_id  │ search_actionitem_      │ filter_actionitem_by_meeting_id │ (none -- no numeric field)
 *                 │                       │   by_text               │ filter_actionitem_by_client_id  │
 *                 │                       │  (searches: description)│ filter_actionitem_by_assignee   │
 *                 │                       │                         │ filter_actionitem_by_status     │
 *                 │                       │                         │ filter_actionitem_by_due_date   │
 *
 * ─── Key Observations ──────────────────────────────────────────────────────
 *
 * 1. NO combined multi-field filter: to find "pending action items for
 *    james-morrison", the agent calls filter_actionitem_by_client_id AND
 *    filter_actionitem_by_status separately, then intersects in-context.
 *
 * 2. NUMERIC fields generate range tools (find_*_range), not exact-match
 *    filters. Input is { min_value, max_value }, not { value }.
 *    Example: find_client_by_age_range({ min_value: 40, max_value: 60 })
 *
 * 3. TEXT search is full-text (RQE FT.SEARCH), not exact match. Multiple
 *    text fields on the same entity share one search tool.
 *    Example: search_meeting_by_text({ query: "retirement" }) searches
 *    both summary and key_decisions fields.
 *
 * 4. Entity name casing: PascalCase names become lowercase in tool names
 *    (FinancialGoal -> financialgoal, ActionItem -> actionitem). No
 *    underscores inserted between words.
 *
 * 5. Every tool description is generic ("RQE tool for context surface: <name>").
 *    The AI agent relies on the tool NAME to understand what it does.
 */

import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env") });

import type { DataModel, CreateSurfaceInput } from "../src/types";

import { ContextSurfaces } from "../src/context-surfaces";

// ── 1. Entity Schemas ──

const CLIENT_ENTITY = {
  name: "Client",
  description: "Wealth management client profile",
  redisKeyTemplate: "wa_client:{client_id}",
  fields: [
    { name: "client_id", type: "str", description: "Unique client identifier", isKeyComponent: true },
    { name: "name", type: "str", description: "Full name", redisIndices: [{ type: "text", weight: 2.0 }] },
    { name: "age", type: "int", description: "Age in years", redisIndices: [{ type: "numeric", sortable: true }] },
    { name: "organization", type: "str", description: "Employer or company", redisIndices: [{ type: "tag" }] },
    { name: "risk_profile", type: "str", description: "Investment risk tolerance level", redisIndices: [{ type: "tag" }] },
    { name: "total_aum", type: "float", description: "Total assets under management in USD", redisIndices: [{ type: "numeric", sortable: true }] },
  ],
  relationships: [
    { name: "holdings", target: "Holding", description: "Portfolio holdings", sourceField: "client_id" },
    { name: "goals", target: "FinancialGoal", description: "Financial goals", sourceField: "client_id" },
    { name: "meetings", target: "Meeting", description: "Meeting history", sourceField: "client_id" },
    { name: "action_items", target: "ActionItem", description: "Action items", sourceField: "client_id" },
  ],
};

const HOLDING_ENTITY = {
  name: "Holding",
  description: "Portfolio position in an asset class",
  redisKeyTemplate: "wa_holding:{holding_id}",
  fields: [
    { name: "holding_id", type: "str", description: "Unique holding identifier", isKeyComponent: true },
    { name: "client_id", type: "str", description: "Owner client ID", redisIndices: [{ type: "tag" }] },
    { name: "asset_class", type: "str", description: "Asset class category", redisIndices: [{ type: "tag" }] },
    { name: "allocation_percent", type: "float", description: "Portfolio allocation percentage", redisIndices: [{ type: "numeric", sortable: true }] },
    { name: "current_value", type: "float", description: "Current market value in USD", redisIndices: [{ type: "numeric", sortable: true }] },
  ],
};

const FINANCIAL_GOAL_ENTITY = {
  name: "FinancialGoal",
  description: "Client financial planning goal",
  redisKeyTemplate: "wa_goal:{goal_id}",
  fields: [
    { name: "goal_id", type: "str", description: "Unique goal identifier", isKeyComponent: true },
    { name: "client_id", type: "str", description: "Owner client ID", redisIndices: [{ type: "tag" }] },
    { name: "type", type: "str", description: "Goal category", redisIndices: [{ type: "tag" }] },
    { name: "target_amount", type: "float", description: "Target dollar amount", redisIndices: [{ type: "numeric", sortable: true }] },
    { name: "target_year", type: "int", description: "Target completion year", redisIndices: [{ type: "numeric", sortable: true }] },
    { name: "status", type: "str", description: "Current goal status", redisIndices: [{ type: "tag" }] },
    { name: "description", type: "str", description: "Goal details and context", redisIndices: [{ type: "text" }] },
  ],
};

const MEETING_ENTITY = {
  name: "Meeting",
  description: "Record of a client-advisor meeting",
  redisKeyTemplate: "wa_meeting:{meeting_id}",
  fields: [
    { name: "meeting_id", type: "str", description: "Unique meeting identifier", isKeyComponent: true },
    { name: "client_id", type: "str", description: "Client who attended", redisIndices: [{ type: "tag" }] },
    { name: "date", type: "str", description: "Meeting date (YYYY-MM-DD)", redisIndices: [{ type: "tag" }] },
    { name: "type", type: "str", description: "Meeting format", redisIndices: [{ type: "tag" }] },
    { name: "duration_minutes", type: "int", description: "Duration in minutes", redisIndices: [{ type: "numeric", sortable: true }] },
    { name: "sentiment", type: "str", description: "Overall client sentiment", redisIndices: [{ type: "tag" }] },
    { name: "summary", type: "str", description: "Meeting summary", redisIndices: [{ type: "text" }] },
    { name: "key_decisions", type: "str", description: "Decisions made during meeting", redisIndices: [{ type: "text" }] },
  ],
  relationships: [
    { name: "action_items", target: "ActionItem", description: "Action items from this meeting", sourceField: "meeting_id" },
  ],
};

const ACTION_ITEM_ENTITY = {
  name: "ActionItem",
  description: "Follow-up task from a meeting",
  redisKeyTemplate: "wa_action:{action_id}",
  fields: [
    { name: "action_id", type: "str", description: "Unique action item identifier", isKeyComponent: true },
    { name: "meeting_id", type: "str", description: "Source meeting ID", redisIndices: [{ type: "tag" }] },
    { name: "client_id", type: "str", description: "Related client ID", redisIndices: [{ type: "tag" }] },
    { name: "assignee", type: "str", description: "Person responsible", redisIndices: [{ type: "tag" }] },
    { name: "description", type: "str", description: "Action item details", redisIndices: [{ type: "text" }] },
    { name: "status", type: "str", description: "Current status", redisIndices: [{ type: "tag" }] },
    { name: "due_date", type: "str", description: "Due date (YYYY-MM-DD)", redisIndices: [{ type: "tag" }] },
  ],
};

// ── 2. Sample Data ──

const CLIENT_RECORDS = [
  {
    client_id: "james-morrison",
    name: "James Morrison",
    age: 52,
    organization: "Meridian Technologies",
    risk_profile: "moderate",
    total_aum: 2400000,
  },
];

const HOLDING_RECORDS = [
  { holding_id: "h-001", client_id: "james-morrison", asset_class: "equities", allocation_percent: 45, current_value: 1080000 },
  { holding_id: "h-002", client_id: "james-morrison", asset_class: "fixed-income", allocation_percent: 30, current_value: 720000 },
  { holding_id: "h-003", client_id: "james-morrison", asset_class: "reits", allocation_percent: 9, current_value: 210000 },
  { holding_id: "h-004", client_id: "james-morrison", asset_class: "cash", allocation_percent: 10, current_value: 240000 },
  { holding_id: "h-005", client_id: "james-morrison", asset_class: "short-duration-bonds", allocation_percent: 4, current_value: 100000 },
  { holding_id: "h-006", client_id: "james-morrison", asset_class: "dividend-etf", allocation_percent: 2, current_value: 50000 },
];

const GOAL_RECORDS = [
  { goal_id: "g-001", client_id: "james-morrison", type: "retirement", target_amount: 3000000, target_year: 2031, status: "active", description: "Retire at 57 with $3M liquid, moderate risk tolerance, $50-75K annual contributions" },
  { goal_id: "g-002", client_id: "james-morrison", type: "education", target_amount: 200000, target_year: 2029, status: "planning", description: "529 plan for daughter Emily, college in ~3 years, needs session with spouse Maya" },
  { goal_id: "g-003", client_id: "james-morrison", type: "tax-optimization", target_amount: 40000, target_year: 2025, status: "completed", description: "Year-end tax loss harvesting from underperforming REIT and international positions" },
  { goal_id: "g-004", client_id: "james-morrison", type: "retirement", target_amount: 0, target_year: 2027, status: "planning", description: "Model dual-retirement scenario -- spouse Maya considering early retirement in 2027" },
];

const MEETING_RECORDS = [
  { meeting_id: "meeting-001", client_id: "james-morrison", date: "2025-09-14", type: "phone", duration_minutes: 28, sentiment: "positive", summary: "Initial introduction call. Reviewed $2.4M portfolio, set $3M retirement target by 2031, agreed quarterly cadence", key_decisions: "Set retirement target at $3M liquid by 2031; agreed on quarterly review cadence" },
  { meeting_id: "meeting-002", client_id: "james-morrison", date: "2025-10-28", type: "phone", duration_minutes: 8, sentiment: "anxious", summary: "Unscheduled call during market correction. Client worried about 2% daily drop. Reassured, decided to stay the course", key_decisions: "No changes -- stay the course" },
  { meeting_id: "meeting-003", client_id: "james-morrison", date: "2025-12-02", type: "google-meet", duration_minutes: 35, sentiment: "neutral-positive", summary: "Year-end review. Agreed to harvest $40K in tax losses. Started 529 plan research for daughter Emily", key_decisions: "Harvest $40K in tax losses; start 529 plan research for Emily" },
  { meeting_id: "meeting-004", client_id: "james-morrison", date: "2026-01-15", type: "phone", duration_minutes: 18, sentiment: "anxious", summary: "Client concerned about REIT exposure after commercial property default news. Sarah to prepare rebalancing proposal", key_decisions: "Sarah to research REIT alternatives; 529 deferred until Maya available" },
  { meeting_id: "meeting-005", client_id: "james-morrison", date: "2026-02-26", type: "google-meet", duration_minutes: 22, sentiment: "positive", summary: "Executed REIT rebalance: $150K from REITs split to $100K short-duration bonds + $50K dividend ETF. Maya may retire 2027", key_decisions: "Rebalance $150K from REITs; James prefers bond fund over individual bonds; model dual-retirement scenario" },
];

const ACTION_ITEM_RECORDS = [
  { action_id: "a-001", meeting_id: "meeting-005", client_id: "james-morrison", assignee: "sarah-chen", description: "Execute REIT to bond/ETF rebalance ($100K short-duration bonds, $50K dividend aristocrats ETF)", status: "completed", due_date: "2026-03-07" },
  { action_id: "a-002", meeting_id: "meeting-005", client_id: "james-morrison", assignee: "sarah-chen", description: "Model dual-retirement income scenario with Maya retiring in 2027", status: "pending", due_date: "2026-03-15" },
  { action_id: "a-003", meeting_id: "meeting-005", client_id: "james-morrison", assignee: "sarah-chen", description: "Schedule dedicated education fund session with Maya present", status: "pending", due_date: "2026-03-31" },
  { action_id: "a-004", meeting_id: "meeting-003", client_id: "james-morrison", assignee: "sarah-chen", description: "Prepare 529 plan comparison report", status: "pending", due_date: "2026-02-01" },
  { action_id: "a-005", meeting_id: "meeting-001", client_id: "james-morrison", assignee: "sarah-chen", description: "Prepare detailed asset allocation proposal", status: "completed", due_date: "2025-10-15" },
];

// ── 3. Helpers ──

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 90000;
const TOTAL_STEPS = 14;

const log = (step: number, message: string): void => {
  console.log(`[${step}/${TOTAL_STEPS}] ${message}`);
};

const logDetail = (message: string): void => {
  console.log(`       ${message}`);
};

const parseRedisUrl = (url: string): { addr: string; username: string; password: string; tls: boolean; db: number } => {
  const parsed = new URL(url);
  const host = parsed.hostname;
  const port = parsed.port || "6379";
  const tls = parsed.protocol === "rediss:";
  const dbPath = parsed.pathname.replace("/", "");
  const db = dbPath ? parseInt(dbPath, 10) : 0;

  return {
    addr: `${host}:${port}`,
    username: parsed.username || "default",
    password: parsed.password,
    tls,
    db,
  };
};

// ── 4. Main Flow ──

const run = async (): Promise<void> => {
  const requiredEnvVars = ["CTX_ADMIN_KEY", "CTX_ADMIN_API_URL", "CTX_MCP_URL", "REDIS_URL"];
  const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
  const hasMissing = missingVars.length > 0;
  if (hasMissing) {
    console.error(`Missing required env vars: ${missingVars.join(", ")}`);
    process.exit(1);
  }

  let surfaceId = "";

  try {
    // Step 1: Initialize
    log(1, "Initializing ContextSurfaces client...");
    const cs = ContextSurfaces.create();

    // Step 2: Define schema
    log(2, "Defining data model: 5 entities (Client, Holding, FinancialGoal, Meeting, ActionItem)");
    const dataModel: DataModel = {
      title: "Wealth Advisor Demo",
      description: "Structured client data for the wealth-advisor context surfaces demo",
      entities: [CLIENT_ENTITY, HOLDING_ENTITY, FINANCIAL_GOAL_ENTITY, MEETING_ENTITY, ACTION_ITEM_ENTITY],
    };

    // Step 3: Create surface
    log(3, 'Creating surface "Wealth Advisor Demo"...');
    const redis = parseRedisUrl(process.env.REDIS_URL!);
    const surfaceInput: CreateSurfaceInput = {
      name: `wealth-advisor-demo-${Date.now()}`,
      description: "Usage example -- wealth advisor structured data",
      dataModel,
      dataSource: {
        type: "redis",
        name: "demo-redis",
        connectionConfig: {
          addr: redis.addr,
          username: redis.username,
          password: redis.password,
          db: redis.db,
          tlsEnabled: redis.tls,
          poolSize: 5,
          minIdleConns: 1,
        },
      },
    };

    const surface = await cs.createSurface(surfaceInput);
    surfaceId = surface.id;
    logDetail(`Surface created: id=${surfaceId}`);

    // Step 4: Create agent key
    log(4, "Creating agent key...");
    const agentKey = await cs.createAgentKey(surfaceId, {
      name: `usage-example-key-${Date.now()}`,
    });
    cs.setAgentKey(agentKey.key);
    logDetail(`Agent key created: ${agentKey.key.slice(0, 12)}...`);

    // Step 5: Load records
    log(5, "Loading records into surface...");
    const entityLoads = [
      { entity: "Client", records: CLIENT_RECORDS },
      { entity: "Holding", records: HOLDING_RECORDS },
      { entity: "FinancialGoal", records: GOAL_RECORDS },
      { entity: "Meeting", records: MEETING_RECORDS },
      { entity: "ActionItem", records: ACTION_ITEM_RECORDS },
    ];

    for (const { entity, records } of entityLoads) {
      const result = await cs.loadRecords(surfaceId, { entity, records });
      logDetail(`${entity}: ${result.loaded} record(s) loaded`);
    }

    // Step 6: Wait for MCP tools
    log(6, "Waiting for MCP tools to become available...");
    let tools: Awaited<ReturnType<typeof cs.listTools>> = [];
    const startTime = Date.now();

    while (Date.now() - startTime < POLL_TIMEOUT_MS) {
      try {
        tools = await cs.listTools();
        const hasTools = tools.length > 0;
        if (hasTools) {
          break;
        }
      } catch {
        // not ready yet
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    const hasNoTools = tools.length === 0;
    if (hasNoTools) {
      throw new Error("Tools did not become available within timeout");
    }
    logDetail(`Tools ready (${tools.length} tools available)`);

    // Step 7: List tools
    log(7, "Available tools:");
    for (const tool of tools) {
      logDetail(`- ${tool.name}`);
    }

    // Step 8: Search by text
    log(8, 'Search: "Morrison"');
    const searchTools = tools.filter((t) => t.name.includes("search_") && t.name.includes("client"));
    const hasSearchTool = searchTools.length > 0;
    if (hasSearchTool) {
      const result = await cs.callTool(searchTools[0].name, { query: "Morrison" });
      logDetail(`Result: ${JSON.stringify(result).slice(0, 200)}...`);
    } else {
      logDetail("No client search tool found -- skipping");
    }

    // Step 9: Filter holdings by asset_class
    log(9, 'Filter holdings by asset_class="equities"');
    const holdingFilterTools = tools.filter((t) => t.name.includes("holding") && t.name.includes("asset_class"));
    const hasHoldingFilter = holdingFilterTools.length > 0;
    if (hasHoldingFilter) {
      const result = await cs.callTool(holdingFilterTools[0].name, { value: "equities" });
      logDetail(`Result: ${JSON.stringify(result).slice(0, 200)}...`);
    } else {
      logDetail("No holding filter tool found -- skipping");
    }

    // Step 10: Get client by ID
    log(10, 'Get client by ID "james-morrison"');
    const getTools = tools.filter((t) => t.name.includes("get_") && t.name.includes("client"));
    const hasGetTool = getTools.length > 0;
    if (hasGetTool) {
      const result = await cs.callTool(getTools[0].name, { id: "james-morrison" });
      logDetail(`Result: ${JSON.stringify(result).slice(0, 200)}...`);
    } else {
      logDetail("No client get tool found -- skipping");
    }

    // Step 11: Filter meetings by sentiment
    log(11, 'Filter meetings by sentiment="anxious"');
    const meetingTools = tools.filter((t) => t.name.includes("meeting") && t.name.includes("sentiment"));
    const hasMeetingFilter = meetingTools.length > 0;
    if (hasMeetingFilter) {
      const result = await cs.callTool(meetingTools[0].name, { value: "anxious" });
      logDetail(`Result: ${JSON.stringify(result).slice(0, 200)}...`);
    } else {
      logDetail("No meeting sentiment filter found -- skipping");
    }

    // Step 12: Filter action items by status
    log(12, 'Filter action items by status="pending"');
    const actionTools = tools.filter((t) => t.name.includes("action") && t.name.includes("status"));
    const hasActionFilter = actionTools.length > 0;
    if (hasActionFilter) {
      const result = await cs.callTool(actionTools[0].name, { value: "pending" });
      logDetail(`Result: ${JSON.stringify(result).slice(0, 200)}...`);
    } else {
      logDetail("No action item status filter found -- skipping");
    }

    // Step 13: Cross-entity query
    log(13, "Cross-entity: james-morrison -> holdings, goals, pending actions");
    logDetail(`Holdings: ${HOLDING_RECORDS.length} records`);
    logDetail(`Goals: ${GOAL_RECORDS.length} records`);
    const pendingActions = ACTION_ITEM_RECORDS.filter((a) => a.status === "pending");
    logDetail(`Pending actions: ${pendingActions.length} records`);

    // Step 14: Cleanup
    log(14, `Cleanup: deleting surface ${surfaceId}...`);
    await cs.deleteSurface(surfaceId);
    surfaceId = "";
    logDetail("Done.");

    await cs.close();
  } catch (error) {
    console.error("Error:", error);

    const hasSurfaceToClean = surfaceId !== "";
    if (hasSurfaceToClean) {
      console.log(`Cleaning up surface ${surfaceId}...`);
      try {
        const cs = ContextSurfaces.getInstance();
        await cs.deleteSurface(surfaceId);
        await cs.close();
      } catch {
        // best-effort
      }
    }
    process.exit(1);
  }
};

run();
