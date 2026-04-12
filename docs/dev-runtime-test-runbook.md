# Runtime Test Runbook

An agent-executable test runbook for validating the Meeting Memory demo application. Run this after any code change to catch regressions across the full stack. Tests are organized into phases -- run as many as the change warrants.

**Reference:** `docs/dev-test-plan.md` defines *what* to test and *why*. This runbook defines *exactly how* to test it, with copy-paste commands and pass/fail criteria.

---

## Prerequisites

All services must be running before executing any phase. Two modes are supported:

**Docker mode (recommended for testing):** `docker compose up --build` starts everything (Redis, AMS, backend + frontend on port 3001, LangGraph on port 2024). The frontend is served as a static build from the backend at `http://localhost:3001`.

**Local dev mode:** Start services individually:

| Service              | Command                                        | Port | Health Check                        |
| -------------------- | ---------------------------------------------- | ---- | ----------------------------------- |
| Redis Stack          | `docker compose up redis`                      | 6379 | `redis-cli ping` returns `PONG`     |
| Agent Memory Server  | `docker compose up agent-memory`               | 8000 | `curl -s http://localhost:8000/v1/health` |
| Backend API          | `npm run dev:api` (from root)                  | 3001 | `curl -s http://localhost:3001/health` |
| Frontend             | `npm run dev:frontend` (from root)             | 3000 | `curl -s http://localhost:3000`     |
| LangGraph (chatbot)  | `npm run dev:langgraph` (from root)            | 2024 | Only needed for chatbot tests       |

**Environment:** `OPENAI_API_KEY` must be set (in `.env` at root for Docker, or `backend/.env` for local dev). See `backend/.env.example` for all variables.

**Shell variables used throughout this runbook:**

```bash
BASE=http://localhost:3001
API=$BASE/api
```

---

## Phase 1 -- Health and API Smoke Tests

**Time:** ~30 seconds | **Tools:** curl, jq | **What it catches:** service connectivity, broken routes, config loading

Run each test independently. Every curl command should return HTTP 200 with the `data` field populated and `error: null`.

### 1.1 Health endpoint

```bash
curl -s $BASE/health | jq .
```

**Pass:** `data.status` is `"ok"`, `data.uptime` is a number > 0, `error` is `null`.

### 1.2 Dataset config

```bash
curl -s -X POST $API/getDataset -H "Content-Type: application/json" -d '{}' | jq .
```

**Pass:** `data.id` is `"wealth-advisor"`, `data.namespace` is `"wealth-advisor"`, `data.userId` is `"sarah-chen"`, `data.branding.title` exists.

### 1.3 List datasets

```bash
curl -s -X POST $API/listDatasets -H "Content-Type: application/json" -d '{}' | jq .
```

**Pass:** `data.datasets` is a non-empty array, `data.active` is `"wealth-advisor"`.

### 1.4 List transcripts

```bash
curl -s -X POST $API/listTranscripts -H "Content-Type: application/json" -d '{}' | jq .
```

**Pass:** `data.transcripts` has 5 items. Each has `id`, `date`, `type`, `chunkCount`. Known IDs: `2025-09-14-phone`, `2025-10-28-phone`, `2025-12-02-google-meet`, `2026-01-15-phone`, `2026-02-26-google-meet`.

### 1.5 Get a transcript

```bash
curl -s -X POST $API/getTranscript \
  -H "Content-Type: application/json" \
  -d '{"transcriptId":"2025-10-28-phone"}' | jq '{meeting_id: .data.meeting.id, chunk_count: (.data.chunks | length)}'
```

**Pass:** `meeting_id` is `"meeting-002"`, `chunk_count` is `28`.

### 1.6 List working memory sessions

```bash
curl -s -X POST $API/listWorkingMemorySessions \
  -H "Content-Type: application/json" -d '{}' | jq .
```

**Pass:** `data.sessions` is an array (may be empty on fresh state), `data.total` is a number.

### 1.7 List summary views

```bash
curl -s -X POST $API/listSummaryViews \
  -H "Content-Type: application/json" -d '{}' | jq .
```

**Pass:** `data.views` is an array. On a non-reset state, expect 2 views: "Client memory summary" (`groupBy: ["user_id"]`) and "Session Recap" (`groupBy: ["session_id"]`).

### 1.8 Search long-term memory

```bash
curl -s -X POST $API/searchLongTermMemory \
  -H "Content-Type: application/json" -d '{}' | jq '{total: .data.total, count: (.data.memories | length)}'
```

**Pass:** `data.memories` is an array, `data.total` is a number >= 0. On fresh state, both are 0.

### 1.9 Automated smoke test script

The script `tests/api/smoke-tests.sh` runs all 20 smoke checks and reports pass/fail:

```bash
bash tests/api/smoke-tests.sh                        # default: http://localhost:3001
bash tests/api/smoke-tests.sh http://localhost:3001   # explicit URL
```

Exit code 0 = all passed, non-zero = number of failures.

---

## Phase 2 -- Full API Lifecycle Test

**Time:** ~2-3 minutes (includes LLM calls + extraction polling) | **Tools:** curl, jq, bash | **What it catches:** session lifecycle regressions, extraction failures, summary computation, suggestion generation

This phase drives the entire application lifecycle through API calls with no browser. It uses `2025-10-28-phone` (28 chunks, 8-minute meeting) for speed.

### 2.1 Complete lifecycle script

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE=http://localhost:3001
API=$BASE/api
TRANSCRIPT_ID="2025-10-28-phone"
STEP=0

post() {
  curl -sf -X POST "$API/$1" -H "Content-Type: application/json" -d "${2:-{}}"
}

step() {
  STEP=$((STEP+1))
  echo ""
  echo "--- Step $STEP: $1 ---"
}

fail() {
  echo "  FAIL: $1"
  exit 1
}

pass() {
  echo "  PASS: $1"
}

# ── Step 1: Reset to clean slate ──
step "Reset lifecycle"
RESET=$(post resetLifecycle)
echo "$RESET" | jq .
VIEWS_CREATED=$(echo "$RESET" | jq '.data.viewsCreated')
[ "$VIEWS_CREATED" -ge 2 ] && pass "Views re-created ($VIEWS_CREATED)" || fail "Expected >= 2 views created, got $VIEWS_CREATED"

# ── Step 2: Load transcript ──
step "Load transcript ($TRANSCRIPT_ID)"
TRANSCRIPT=$(post getTranscript "{\"transcriptId\":\"$TRANSCRIPT_ID\"}")
CHUNK_COUNT=$(echo "$TRANSCRIPT" | jq '.data.chunks | length')
MEETING_ID=$(echo "$TRANSCRIPT" | jq -r '.data.meeting.id')
echo "  Meeting: $MEETING_ID, Chunks: $CHUNK_COUNT"
[ "$CHUNK_COUNT" -eq 28 ] && pass "Chunk count correct" || fail "Expected 28 chunks, got $CHUNK_COUNT"

# ── Step 3: Create working memory session ──
step "Create working memory"
CREATE=$(post createWorkingMemory "{\"transcriptId\":\"$TRANSCRIPT_ID\"}")
SESSION_ID=$(echo "$CREATE" | jq -r '.data.sessionId')
CREATED=$(echo "$CREATE" | jq -r '.data.created')
echo "  Session: $SESSION_ID"
[ -n "$SESSION_ID" ] && [ "$SESSION_ID" != "null" ] && pass "Session created" || fail "No sessionId returned"

# ── Step 4: Append all chunks ──
step "Append all $CHUNK_COUNT chunks"
for i in $(seq 0 $((CHUNK_COUNT - 1))); do
  CHUNK=$(echo "$TRANSCRIPT" | jq -c ".data.chunks[$i]")
  IS_LAST="false"
  [ "$i" -eq $((CHUNK_COUNT - 1)) ] && IS_LAST="true"

  RESULT=$(post appendWorkingMemory "{\"sessionId\":\"$SESSION_ID\",\"chunk\":$CHUNK,\"isLastChunk\":$IS_LAST}")
  TOKENS=$(echo "$RESULT" | jq '.data.tokens')

  if [ "$((i % 7))" -eq 0 ] || [ "$IS_LAST" = "true" ]; then
    echo "  Chunk $((i+1))/$CHUNK_COUNT: tokens=$TOKENS, isLast=$IS_LAST"
  fi
done
pass "All $CHUNK_COUNT chunks appended"

# ── Step 5: Verify working memory ──
step "Verify working memory"
WM=$(post getWorkingMemory "{\"sessionId\":\"$SESSION_ID\"}")
WM_TOKENS=$(echo "$WM" | jq '.data.tokens')
WM_MESSAGES=$(echo "$WM" | jq '.data.messages | length')
echo "  Tokens: $WM_TOKENS, Messages: $WM_MESSAGES"
[ "$WM_TOKENS" -gt 0 ] && pass "Tokens > 0" || fail "Tokens is 0"

# ── Step 6: Poll for long-term memory extraction ──
step "Poll for LT extraction (up to 60s)"
LT_TOTAL=0
for attempt in $(seq 1 12); do
  sleep 5
  LT=$(post searchLongTermMemoryBySession "{\"sessionId\":\"$SESSION_ID\"}")
  LT_TOTAL=$(echo "$LT" | jq '.data.total')
  echo "  Poll $attempt/12: $LT_TOTAL memories found"
  [ "$LT_TOTAL" -gt 0 ] && break
done
[ "$LT_TOTAL" -gt 0 ] && pass "LT extraction produced $LT_TOTAL memories" || fail "No LT memories after 60s"

# ── Step 7: Validate memory content ──
step "Validate memory content"
ALL_TEXT=$(echo "$LT" | jq -r '[.data.memories[].text] | join(" ")' | tr '[:upper:]' '[:lower:]')
FOUND_KEYWORDS=0
for keyword in "market" "portfolio" "dividend"; do
  if echo "$ALL_TEXT" | grep -qi "$keyword"; then
    echo "  Found keyword: $keyword"
    FOUND_KEYWORDS=$((FOUND_KEYWORDS+1))
  else
    echo "  Missing keyword: $keyword (acceptable -- LLM output varies)"
  fi
done
[ "$FOUND_KEYWORDS" -ge 1 ] && pass "At least 1 expected keyword found in memories" || fail "No expected keywords in extracted memories"

# ── Step 8: List summary views ──
step "List summary views"
VIEWS=$(post listSummaryViews)
VIEW_COUNT=$(echo "$VIEWS" | jq '.data.views | length')
echo "  Views: $VIEW_COUNT"
[ "$VIEW_COUNT" -ge 2 ] && pass "Summary views present" || fail "Expected >= 2 views, got $VIEW_COUNT"

# ── Step 9: Compute Client Memory Summary ──
step "Compute Client Memory Summary"
CLIENT_VIEW_ID=$(echo "$VIEWS" | jq -r '.data.views[] | select(.name == "Client memory summary") | .viewId')
echo "  View ID: $CLIENT_VIEW_ID"
[ -n "$CLIENT_VIEW_ID" ] && [ "$CLIENT_VIEW_ID" != "null" ] || fail "Client memory summary view not found"

SUMMARY=$(post computeSummary "{\"viewId\":\"$CLIENT_VIEW_ID\",\"group\":{\"user_id\":\"sarah-chen\"}}")
SUMMARY_TEXT=$(echo "$SUMMARY" | jq -r '.data.summary // empty')
SUMMARY_LEN=${#SUMMARY_TEXT}
echo "  Summary length: $SUMMARY_LEN chars"
[ "$SUMMARY_LEN" -gt 50 ] && pass "Summary has meaningful content" || fail "Summary too short ($SUMMARY_LEN chars)"

# ── Step 10: Get computed summaries ──
step "Get computed summaries"
COMPUTED=$(post getComputedSummaries "{\"viewId\":\"$CLIENT_VIEW_ID\"}")
PARTITION_COUNT=$(echo "$COMPUTED" | jq '.data.summaries | length')
echo "  Partitions: $PARTITION_COUNT"
[ "$PARTITION_COUNT" -ge 1 ] && pass "Computed partition exists" || fail "No computed partitions"

# ── Step 11: Generate a suggestion ──
step "Generate suggestion"
SUGGESTION=$(post generateSuggestion "{\"sessionId\":\"$SESSION_ID\",\"chunkIndex\":5}")
HAS_TOPICS=$(echo "$SUGGESTION" | jq '(.data.detectedTopics | length) > 0')
HAS_SUGGESTION=$(echo "$SUGGESTION" | jq '.data.suggestion != null')
echo "  Has suggestion: $HAS_SUGGESTION, Has topics: $HAS_TOPICS"
([ "$HAS_SUGGESTION" = "true" ] || [ "$HAS_TOPICS" = "true" ]) && pass "Suggestion or topics returned" || fail "Neither suggestion nor topics returned"

# ── Step 12: List suggestions ──
step "List suggestions"
SUGGESTIONS=$(post listSuggestions "{\"sessionId\":\"$SESSION_ID\"}")
SUGGESTION_COUNT=$(echo "$SUGGESTIONS" | jq '.data.total')
TOPIC_COUNT=$(echo "$SUGGESTIONS" | jq '.data.detectedTopics | length')
echo "  Suggestions: $SUGGESTION_COUNT, Topics: $TOPIC_COUNT"
pass "Suggestion list returned (count=$SUGGESTION_COUNT, topics=$TOPIC_COUNT)"

# ── Step 13: Verify session appears in list ──
step "Verify session in list"
SESSIONS=$(post listWorkingMemorySessions)
SESSION_FOUND=$(echo "$SESSIONS" | jq --arg sid "$SESSION_ID" '[.data.sessions[] | select(. == $sid)] | length')
[ "$SESSION_FOUND" -ge 1 ] && pass "Session found in list" || fail "Session $SESSION_ID not in session list"

# ── Step 14: Final reset ──
step "Final reset"
FINAL_RESET=$(post resetLifecycle)
SESSIONS_DELETED=$(echo "$FINAL_RESET" | jq '.data.sessionsDeleted')
MEMORIES_DELETED=$(echo "$FINAL_RESET" | jq '.data.memoriesDeleted')
echo "  Deleted: $SESSIONS_DELETED sessions, $MEMORIES_DELETED memories"
[ "$SESSIONS_DELETED" -ge 1 ] && pass "Sessions cleaned up" || fail "No sessions deleted"

# ── Summary ──
echo ""
echo "==========================================="
echo "  PHASE 2 COMPLETE: All $STEP steps passed"
echo "==========================================="
```

### 2.2 Running Phase 2

```bash
bash tests/api/lifecycle-test.sh                        # default: http://localhost:3001
bash tests/api/lifecycle-test.sh http://localhost:3001   # explicit URL
```

Exit code 0 = all steps passed. On failure, prints which step failed and exits immediately.

**Note:** The inline script above is for reference. The actual tested, maintained version is in `tests/api/lifecycle-test.sh`.

### 2.3 Transcript reference (for choosing test data)

| Transcript ID             | Chunks | Duration | Key Topics                                     |
| ------------------------- | ------ | -------- | ---------------------------------------------- |
| `2025-09-14-phone`        | 44     | 15 min   | Initial onboarding, portfolio overview          |
| `2025-10-28-phone`        | 28     | 8 min    | Market correction, portfolio reassurance         |
| `2025-12-02-google-meet`  | 53     | 35 min   | Year-end review, tax planning                   |
| `2026-01-15-phone`        | 38     | 18 min   | REIT concern, 529 plan                          |
| `2026-02-26-google-meet`  | 69     | 45 min   | Retirement, REIT rebalance, bond funds          |

Use `2025-10-28-phone` (28 chunks) for fast iteration. Use `2026-02-26-google-meet` (69 chunks) to test mid-playback AMS auto-extraction (context window fills before last chunk).

---

## Phase 3 -- Browser Automation Tests

**Time:** ~2 minutes | **Tools:** Playwright (headless Chromium) | **What it catches:** UI regressions, broken interactions, tab switching, DOM rendering issues

**Important:** In Docker mode (`docker compose up --build`), the frontend is served from the backend at port 3001 (not 3000). The Playwright config defaults to `http://localhost:3001`. Override with `APP_URL=http://localhost:3000` for local dev mode.

### 3.1 Setup

Install Playwright if not already present:

```bash
cd tests/playwright
npm install
npx playwright install chromium
cd ../..
```

### 3.2 Selector Reference

The frontend uses BEM-style CSS classes. No `data-testid` attributes exist. Key selectors:

**Transcript panel:**

| Element                | Selector                                                        |
| ---------------------- | --------------------------------------------------------------- |
| Panel root             | `.transcript-panel`                                             |
| Transcript dropdown    | `.toolbar__select--transcript`                                  |
| Speed dropdown         | `.toolbar__select--speed`                                       |
| Play/Pause button      | `.toolbar__play-pause-btn`                                      |
| Next button            | `.toolbar__next-btn`                                            |
| Reset button           | `.toolbar__reset-btn`                                           |
| Chunk feed             | `.transcript-feed`                                              |
| Individual chunk       | `.transcript-chunk`                                             |
| New chunk (animating)  | `.transcript-chunk--new`                                        |
| Status chip            | `.playback-controls__status-chip`                               |
| Status chip by state   | `.playback-controls__status-chip--playing`, `--paused`, `--completed`, `--idle` |
| Chunk counter          | `.playback-controls__count`                                     |
| Health dot             | `.status-dot--ok`, `.status-dot--error`                         |
| Progress bar           | `.playback-controls__progress`                                  |

**Memory explorer panel:**

| Element                | Selector                                                |
| ---------------------- | ------------------------------------------------------- |
| Panel root             | `.memory-explorer-panel`                                |
| Tab bar                | `.memory-explorer-panel__tabs`                          |
| Tab by label           | `role=tab` with name matching config label              |
| Tab content area       | `.memory-explorer-panel__content`                       |
| Suggestion banner      | `.suggestion-banner`                                    |
| Banner active          | `.suggestion-banner--active`                            |
| Banner "View details"  | `.suggestion-banner__view-btn`                          |

**Working Memory tab:**

| Element         | Selector                           |
| --------------- | ---------------------------------- |
| Tab root        | `.working-memory-tab`              |
| Session info    | `.working-memory-tab__session-info`|
| Info values     | `.working-memory-tab__info-value`  |
| Context section | `.working-memory-tab__context`     |
| Messages        | `.working-memory-tab__message`     |

**Long-Term Memory tab:**

| Element         | Selector                            |
| --------------- | ----------------------------------- |
| Tab root        | `.long-term-memory-tab`             |
| Total count     | `.long-term-memory-tab__total`      |
| Scope sub-tabs  | MUI `role=tab` with "This session" / "All memories" |
| Memory card     | `.memory-card`                      |
| Card by type    | `.memory-card--semantic`, `--episodic`, `--message` |
| Card text       | `.memory-card__text`                |

**AI Copilot tab:**

| Element            | Selector                              |
| ------------------ | ------------------------------------- |
| Tab root           | `.ai-copilot-tab`                     |
| Detected topics    | `.detected-topics`                    |
| Topic item         | `.detected-topics__item`              |
| Topic by status    | `.detected-topics__item--discussed`, `--pending`, `--new`, `--question` |
| Suggestion card    | `.suggestion-card`                    |
| New suggestion     | `.suggestion-card--new`               |
| Status text        | `.ai-copilot-tab__status-text`        |

**Summary Views tab:**

| Element            | Selector                              |
| ------------------ | ------------------------------------- |
| Tab root           | `.summary-views-tab`                  |
| View block         | `.summary-views-tab__view`            |
| Compute button     | MUI `Button` containing "Compute summary" |
| Computed card      | `.computed-summary-card`              |
| Summary text       | `.computed-summary-card__text`        |
| Recompute button   | MUI `Button` containing "Recompute"   |

**Redis Metrics tab:**

| Element        | Selector                              |
| -------------- | ------------------------------------- |
| Tab root       | `.redis-metrics-tab`                  |
| Metric rows    | `.redis-metrics-tab__row`             |
| Label / value  | `.redis-metrics-tab__label`, `__value`|

**Shared:**

| Element        | Selector                              |
| -------------- | ------------------------------------- |
| Confirm dialog | `.confirm-dialog`                     |
| Confirm button | `.confirm-dialog__confirm-btn`        |
| Cancel button  | `.confirm-dialog__cancel-btn`         |
| Empty state    | `.empty-state`                        |
| Section card   | `.section-card`                       |

**CopilotKit sidebar:**

| Element       | Selector                              |
| ------------- | ------------------------------------- |
| Sidebar       | `.copilotKitSidebar`                  |
| Chat window   | `.copilotKitWindow`                   |
| Input         | `.copilotKitInput textarea`           |
| Send button   | `.copilotKitButton`                   |
| Messages      | `.copilotKitMessage`                  |

### 3.3 Test Files

All Playwright test specs live in `tests/playwright/`. Shared helpers (selectors, API reset, navigation) are in `tests/playwright/helpers.ts`.

| File                        | Tests | What It Validates                                        |
| --------------------------- | ----- | -------------------------------------------------------- |
| `page-load.spec.ts`         | 5     | Branding title, health dot, transcript dropdown, 5 tabs, footer |
| `playback.spec.ts`          | 5     | Play, pause (no new chunks), resume, next button, completion |
| `working-memory.spec.ts`    | 1     | Session info and data display after stepping chunks      |
| `long-term-memory.spec.ts`  | 1     | Memory cards appear after full playback + extraction     |
| `summary-views.spec.ts`     | 1     | View blocks present; compute button triggers summary     |
| `reset.spec.ts`             | 1     | Confirm dialog, clean slate, idle status after reset     |
| `chatbot.spec.ts`           | 1     | Sidebar opens and shows initial state                    |

### 3.4 Running Playwright Tests

```bash
cd tests/playwright

# Run all tests (headless)
npx playwright test --project=chromium

# Run a specific test file
npx playwright test playback.spec.ts --project=chromium

# Run with visible browser for debugging
npx playwright test --project=chromium --headed

# Run with trace for debugging failures
npx playwright test --project=chromium --trace on

# Override app URL (default: http://localhost:3001 for Docker mode)
APP_URL=http://localhost:3000 npx playwright test --project=chromium
```

---

## Phase 4 -- Manual Visual Checklist

**Time:** ~5 minutes | **Tools:** human eyes, browser | **What it catches:** visual regressions, animation quality, theme consistency

Open the app at `http://localhost:3000` and walk through each item:

### 4.1 Theme and Layout

- [ ] Dark theme: midnight background on all surfaces, no white flashes
- [ ] Panel split: transcript panel ~55%, memory explorer ~45%
- [ ] Header shows "Wealth advisor memory agent" (from config)
- [ ] Footer shows subtitle text
- [ ] Redis accent color (`#dc382c`) used on interactive elements

### 4.2 Transcript Playback Visuals

- [ ] New chunks fade-up animate when appearing
- [ ] Old chunks are static (no re-animation)
- [ ] Auto-scroll follows new chunks to bottom
- [ ] Scrolling up manually pauses auto-scroll
- [ ] Scrolling back to bottom resumes auto-scroll
- [ ] RM chunks and Client chunks have distinct visual styling
- [ ] Progress bar advances smoothly during playback
- [ ] Status chip color matches state (playing = active, paused = muted, completed = success)

### 4.3 Memory Explorer Visuals

- [ ] Tab switching is instant, no layout jumps
- [ ] Suggestion banner animates when new suggestion arrives
- [ ] Memory type badges: semantic = blue tint, episodic = warm/yellow, message = neutral
- [ ] Memory cards animate in on first appearance
- [ ] Suggestion cards in AI Copilot tab fade in
- [ ] Detected topics show correct status icons (checkmark for discussed, circle for pending)

### 4.4 CopilotKit Sidebar

- [ ] Dark theme consistent with app (not default white CopilotKit theme)
- [ ] Font matches app (Space Grotesk)
- [ ] Streaming responses render progressively
- [ ] Input area is usable, placeholder text visible

### 4.5 Responsive Behavior

- [ ] At 1920x1080: full two-panel layout, no overflow
- [ ] Scrollable areas have proper overflow handling (no double scrollbars)
- [ ] Long memory text truncates with "Show more" expand

---

## Known Issues

Reference `docs/dev-pending-tasks.md` for current bugs:

| ID    | Summary                                          | Impact on Tests                                                   |
| ----- | ------------------------------------------------ | ----------------------------------------------------------------- |
| BUG-2 | Append errors silently swallowed                 | Phase 3 playback tests won't detect backend failures during play  |
| BUG-3 | Reset only deletes first 100 LT memories         | Phase 2 lifecycle test calls reset in a loop as workaround        |

---

## Quick Reference: Running Each Phase

```bash
# Phase 1: Smoke tests (~30s)
bash tests/api/smoke-tests.sh

# Phase 2: Full API lifecycle (~2-3 min, includes LLM calls)
bash tests/api/lifecycle-test.sh

# Phase 3: Browser automation (~2 min)
cd tests/playwright && npx playwright test --project=chromium

# Phase 4: Manual visual checks (~5 min)
# Open http://localhost:3001 (Docker) or http://localhost:3000 (local dev)
# Follow checklist in section 4
```

## Test File Structure

```
tests/
├── api/
│   ├── smoke-tests.sh          # Phase 1: 20 health + endpoint checks
│   └── lifecycle-test.sh       # Phase 2: 15-step full lifecycle
│
└── playwright/
    ├── package.json
    ├── playwright.config.ts    # Chromium, 1920x1080, baseURL from APP_URL
    ├── helpers.ts              # Shared utilities (selectors, API reset, navigation)
    ├── page-load.spec.ts       # 5 tests: branding, health, dropdown, tabs, footer
    ├── playback.spec.ts        # 5 tests: play, pause, resume, next, completion
    ├── working-memory.spec.ts  # 1 test: session info after stepping chunks
    ├── long-term-memory.spec.ts # 1 test: memory cards after extraction
    ├── summary-views.spec.ts   # 1 test: view blocks and compute button
    ├── reset.spec.ts           # 1 test: confirm dialog and idle state
    └── chatbot.spec.ts         # 1 test: sidebar opens
```
