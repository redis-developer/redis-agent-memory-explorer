# Meeting Memory Demo -- End-to-End Test Plan

## Goal

Systematically test the entire Meeting Memory demo application from transcript loading through memory extraction, summary generation, live suggestions, and UI stats. This plan defines manual test scenarios, expected outcomes, quality checks for LLM-generated content, and an automation strategy.

**Prerequisites for all tests:**

- Redis Stack running (`docker compose up redis` or local)
- Agent Memory Server running (`http://localhost:8000`)
- Backend running (`npm run dev` in backend, port 3001)
- Frontend running (`npm run dev` in frontend, port 3000)
- LangGraph dev server running (`npm run dev:langgraph` in backend, port 2024) -- needed for chatbot tests only
- `OPENAI_API_KEY` set in `.env`

---

## Test Areas Overview

| #   | Area                                                            | Sections                                                      |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | [Transcript Playback](#1-transcript-playback)                   | Load, play, pause, next, speed, reset, load existing session  |
| 2   | [Working Memory](#2-working-memory)                             | Polling, token growth, context summarization, message display |
| 3   | [Long-Term Memory Extraction](#3-long-term-memory-extraction)   | Extraction trigger, memory quality, grouping, completeness    |
| 4   | [Live Suggestions (AI Copilot)](#4-live-suggestions-ai-copilot) | Trigger timing, topic detection, suggestion quality, banner   |
| 5   | [Summary Views](#5-summary-views)                               | Pre-seeded views, compute, recompute, multiple sessions       |
| 6   | [Redis Metrics Tab](#6-redis-metrics-tab)                       | Stats accuracy, lifecycle counts                              |
| 7   | [Chatbot (CopilotKit)](#7-chatbot-copilotkit)                   | Session routing, LT insights, WM insights, summary views, theme |
| 8   | [Reset & Lifecycle](#8-reset--lifecycle)                        | Full reset, re-creation of views, clean slate                 |
| 9   | [Edge Cases & Error Handling](#9-edge-cases--error-handling)    | Backend down, slow API, rapid clicking                        |
| 10  | [Visual & UX Polish](#10-visual--ux-polish)                     | Animations, auto-scroll, theming, layout                      |

---

## 1. Transcript Playback

### 1.1 Load Transcript List

| ID      | Test                          | Steps                                            | Expected                                                                                    |
| ------- | ----------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| T-1.1.1 | Transcript dropdown populates | Open app, wait for config load                   | Dropdown shows all transcripts from `data/wealth-advisor/transcripts/` with dates and types |
| T-1.1.2 | Session dropdown populates    | Open app with existing sessions from a prior run | "Load Existing Session" dropdown lists previous session IDs with formatted labels           |

### 1.2 Play / Continuous Playback

| ID      | Test                        | Steps                                                      | Expected                                                                                                                                         |
| ------- | --------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-1.2.1 | Start playback              | Select transcript, click Play                              | Status changes IDLE -> LOADING -> PLAYING; chunks appear one at a time at the configured interval; progress bar advances; chunk count increments |
| T-1.2.2 | Default speed (1x)          | Play with default speed selection                          | Chunks appear every `config.playbackDefaults.intervalMs` (2000ms)                                                                                |
| T-1.2.3 | Speed change mid-play       | While playing, switch from 1x to 2x                        | Interval halves; chunks appear faster. Verify no duplicate chunks or skipped chunks                                                              |
| T-1.2.4 | All speeds                  | Test each speed option in `config.playbackDefaults.speeds` | Each speed's `intervalMs` is respected                                                                                                           |
| T-1.2.5 | Playback completion         | Let playback run to end                                    | Last chunk sent with `isLastChunk: true`; status -> COMPLETED; progress bar at 100%; "Playback Complete" status chip shown                       |
| T-1.2.6 | Session creation on play    | Click Play                                                 | `POST /api/createWorkingMemory` called; `onSessionCreated` fires; MemoryExplorerPanel receives non-null `sessionId`                              |
| T-1.2.7 | Append per tick             | Monitor network during playback                            | `POST /api/appendWorkingMemory` called for each chunk; fire-and-forget pattern (UI doesn't block on response)                                    |
| T-1.2.8 | Transcript feed auto-scroll | Play transcript with many chunks                           | Feed auto-scrolls to bottom as new chunks arrive                                                                                                 |
| T-1.2.9 | Chunk entrance animation    | Watch as chunks appear                                     | New chunks fade-up animate; old chunks are static                                                                                                |

### 1.3 Pause

| ID      | Test                  | Steps                           | Expected                                                                      |
| ------- | --------------------- | ------------------------------- | ----------------------------------------------------------------------------- |
| T-1.3.1 | Pause mid-play        | Click Pause while playing       | Status -> PAUSED; no new chunks appear; displayed chunks and session intact   |
| T-1.3.2 | Resume after pause    | Pause, then click Play          | Playback resumes from the paused position (not from start); status -> PLAYING |
| T-1.3.3 | Pause preserves state | Pause, check Working Memory tab | Working memory still accessible; data reflects chunks sent so far             |

### 1.4 Next (Step-by-Step)

| ID      | Test                      | Steps                                                               | Expected                                                                                                         |
| ------- | ------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| T-1.4.1 | Next from idle            | Select transcript, click Next (instead of Play)                     | Session created; exactly one chunk displayed; status -> PAUSED; `appendWorkingMemory` called once                |
| T-1.4.2 | Next during pause         | Pause playback, click Next                                          | Exactly one more chunk appended; chunk count increments by 1                                                     |
| T-1.4.3 | Next during play          | While playing, click Next                                           | One extra chunk immediately displayed (the next one in sequence); interval timer continues for subsequent chunks |
| T-1.4.4 | Next at last chunk        | Step through until second-to-last chunk, click Next                 | Last chunk displayed with `isLastChunk: true`; status -> COMPLETED                                               |
| T-1.4.5 | Rapid next clicks         | Click Next rapidly 10 times                                         | Exactly 10 chunks appended in order; no duplicates; no race conditions; each append call fires                   |
| T-1.4.6 | Next triggers suggestions | Click Next repeatedly until chunk count = `triggerEveryNChunks` (5) | Live suggestion generation triggered at chunk index 5 (or first N-chunk boundary)                                |

### 1.5 Load Existing Session

| ID      | Test                     | Steps                                                                                                | Expected                                                                                                                                                 |
| ------- | ------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-1.5.1 | Load existing session    | After a full playback + reset (keeping sessions), reload page, select existing session from dropdown | Full transcript displayed instantly (no interval playback); status -> COMPLETED; MemoryExplorerPanel shows all memory data (WM, LT, suggestions, topics) |
| T-1.5.2 | Session ID parsing       | Load session with ID `playback-2026-02-26-google-meet-{timestamp}`                                   | `transcriptId` correctly parsed as `2026-02-26-google-meet`; correct transcript loaded and displayed                                                     |
| T-1.5.3 | AI Copilot tab populates | Load existing session that had suggestions                                                           | AI Copilot tab shows all previously generated suggestions and detected topics from `listSuggestions`                                                     |

### 1.6 Clear All & Reset

| ID      | Test                     | Steps                                       | Expected                                                                                                             |
| ------- | ------------------------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| T-1.6.1 | Reset during idle        | Click "Clear All" when no session is active | Confirm dialog appears; on confirm, `resetLifecycle` called; sessions list cleared                                   |
| T-1.6.2 | Reset during playback    | Click "Clear All" while playing             | Confirm dialog; on confirm, interval cleared, reset API called, all state cleared, status -> IDLE                    |
| T-1.6.3 | Reset after completion   | Complete a full playback, then reset        | All WM sessions deleted, all LT memories deleted, all summary views deleted and re-created; frontend clears all data |
| T-1.6.4 | Cancel reset             | Click "Clear All", then Cancel in dialog    | No changes; playback continues if it was playing                                                                     |
| T-1.6.5 | Reset clears suggestions | After playback with suggestions, reset      | AI Copilot tab empty; banner shows placeholder; Redis copilot/\* keys cleared                                        |

---

## 2. Working Memory

### 2.1 Polling & Data Display

| ID      | Test                      | Steps                                   | Expected                                                                         |
| ------- | ------------------------- | --------------------------------------- | -------------------------------------------------------------------------------- |
| T-2.1.1 | Polling starts on session | Start playback; open Working Memory tab | `POST /api/getWorkingMemory` called every 3s; data updates in UI                 |
| T-2.1.2 | Token count grows         | Watch token count during playback       | Token count increases with each append; context window usage bar grows           |
| T-2.1.3 | Session info correct      | Check session info section              | Shows correct session ID, user ID, namespace, created/updated timestamps         |
| T-2.1.4 | Messages preview          | Check messages section                  | Shows last N messages with "Show all" expandable; messages match appended chunks |
| T-2.1.5 | Context window gauge      | Watch during long transcript            | Gauge shows percentage; color changes: green < 50%, yellow 50-80%, red > 80%     |

### 2.2 Context Summarization

| ID      | Test                    | Steps                                                          | Expected                                                                                                               |
| ------- | ----------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| T-2.2.1 | Context summary appears | Play a long transcript (50+ chunks) until context window fills | `context` field becomes non-null in working memory; "Working Memory Summary" card appears with highlighted styling     |
| T-2.2.2 | Summary content quality | Read the auto-generated context summary                        | Summary accurately reflects the conversation topics discussed so far; mentions key participants, decisions, and topics |
| T-2.2.3 | Summary updates         | Continue playback after first summary                          | Summary may update as more context is added; new summary reflects additional conversation                              |

### 2.3 Working Memory After Completion

| ID      | Test                           | Steps                                                                  | Expected                                                                                   |
| ------- | ------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| T-2.3.1 | Final state                    | Complete playback, check Working Memory tab                            | Shows final token count, full context, all messages; polling should stop after one final fetch (see IMP-1 in `docs/dev-pending-tasks.md`) |
| T-2.3.2 | Token count from append result | During playback, compare `lastAppendResult.tokens` with polled WM data | Values should be consistent (append result may be slightly ahead due to polling lag)       |

---

## 3. Long-Term Memory Extraction

### 3.1 Extraction Trigger & Polling

**Two extraction triggers exist (important for testing):**

1. **Explicit (app-controlled):** The backend sends `longTermMemoryStrategy: DISCRETE` on the **last chunk** (`isLastChunk: true`), explicitly requesting extraction from AMS.
2. **Automatic (AMS-controlled):** The Agent Memory Server itself can trigger extraction automatically during **any** `putWorkingMemory` call when the working memory context window fills up and AMS compresses/summarizes the conversation. This happens transparently -- no explicit flag from the backend is needed. Long transcripts or slow playback speeds can cause AMS to extract memories **mid-playback**, well before the last chunk is sent.

This means **LT memories can appear at any time during playback**, not just after completion.

**Polling strategy (expected behavior after BUG-1 fix):**

- **During playback:** Poll continuously at `EXTRACTION_POLL_INTERVAL_MS` (5s). Do NOT stop when `total > 0` -- keep polling to pick up additional extraction rounds.
- **After playback completes:** Continue polling for a grace period of `EXTRACTION_MAX_WAIT_MS` (60s) to catch final extraction results. Optionally stop earlier if the memory count stabilizes (same `total` for 2-3 consecutive polls).
- **After grace period:** Stop polling.
- See `docs/dev-pending-tasks.md` BUG-1 for the fix details.

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| T-3.1.1 | Explicit extraction on last chunk | Complete playback (last chunk with `isLastChunk: true`) | Backend sends `longTermMemoryStrategy: DISCRETE` to AMS; extraction starts in background |
| T-3.1.2 | AMS auto-extraction mid-playback | Play a long transcript (50+ chunks) at slow speed (1x = 2s); monitor LT Memory tab **during** playback | Memories may start appearing **before playback completes**, when AMS auto-summarizes the context window. This is an AMS-level feature triggered transparently during `putWorkingMemory`. Verify by checking LT tab mid-playback |
| T-3.1.3 | Polling continues during playback | Start playback; switch to LT tab; note memory count when first memories appear; continue playback | Polling runs at 5s intervals throughout playback. After first memories appear, polling does NOT stop -- it continues detecting additional extraction rounds as more chunks are appended and AMS extracts again |
| T-3.1.4 | Polling continues through completion | Let playback complete; monitor network tab | After `isLastChunk` is sent, polling continues at 5s intervals for up to `EXTRACTION_MAX_WAIT_MS` (60s) to catch the explicit extraction result |
| T-3.1.5 | Polling stops after grace period | Complete playback; wait 60s+ | Polling stops after `EXTRACTION_MAX_WAIT_MS` grace period expires. Alternatively, if count stabilization is implemented, polling stops when `total` is unchanged for 2-3 consecutive polls |
| T-3.1.6 | All extraction rounds auto-detected | Play a long transcript to completion; watch LT tab without clicking Refresh | Both mid-playback AMS auto-extractions AND the explicit last-chunk extraction results are auto-detected by polling -- no manual Refresh needed |
| T-3.1.7 | Refresh button works at any time | Click Refresh on LT tab at any point | Memories re-fetched on demand; useful after grace period or when user wants immediate update |
| T-3.1.8 | Short transcript -- no mid-playback extraction | Play a short transcript (< 20 chunks) | Context window never fills during playback; LT memories only appear **after** last chunk triggers explicit extraction. Polling detects them within 5-15s post-completion |

### 3.2 Memory Quality & Completeness

These tests validate that the LLM extraction produces meaningful, complete memories from the transcript.

| ID      | Test                 | Transcript                                                                                     | Expected Memories                                                                                              | Quality Check                                                                         |
| ------- | -------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| T-3.2.1 | Key facts extracted  | `2026-02-26-google-meet`                                                                       | Maya's early retirement 2027; REIT rebalance $150K; bond fund preference; Emily college 2027                   | Each key decision and life event from the transcript is captured as a separate memory |
| T-3.2.2 | Memory types correct | Same transcript                                                                                | Semantic: preferences, facts; Episodic: events with dates                                                      | Memory type classification matches the nature of the information                      |
| T-3.2.3 | Topics tagged        | Check topic tags on extracted memories                                                         | Topics like "retirement", "REIT", "bonds", "education" present                                                 | Topics are relevant and not overly generic                                            |
| T-3.2.4 | Entities tagged      | Check entity tags                                                                              | Entities like "Maya Morrison", "James Morrison", "Emily" present                                               | Named entities correctly identified                                                   |
| T-3.2.5 | No hallucinations    | Review all extracted memories against transcript                                               | Every memory should be traceable to specific transcript content                                                | No fabricated facts or numbers not in the transcript                                  |
| T-3.2.6 | Completeness         | Compare extracted memories against `meeting.summary.keyDecisions` and `meeting.summary.topics` | All key decisions and topics from the transcript metadata are represented in extracted memories                | Nothing significant missed                                                            |
| T-3.2.7 | Multiple transcripts | Run playback for 2-3 different transcripts sequentially                                        | Each transcript's extraction produces distinct, non-overlapping memories; memories are scoped to their session | Cross-session isolation                                                               |

### 3.3 Memory Display

| ID      | Test                 | Steps                               | Expected                                                                             |
| ------- | -------------------- | ----------------------------------- | ------------------------------------------------------------------------------------ |
| T-3.3.1 | Grouped by type      | Check Long-Term Memory tab          | Memories grouped into Semantic, Episodic, Message sections with correct count badges |
| T-3.3.2 | Session vs All scope | Toggle between SESSION and ALL tabs | SESSION shows only current session's memories; ALL shows cross-session total         |
| T-3.3.3 | Memory card details  | Expand a memory card                | Shows full text, topics as chips, entities as chips, timestamp, memory type badge    |
| T-3.3.4 | Search via chatbot   | Open chatbot sidebar; ask "What do we know about retirement?" | Agent uses `searchMemories` tool; response references relevant LT memories. See section 7 for full chatbot tests. Note: `useLongTermMemory.searchByText` exists in the hook but is not wired to any UI element in the LT tab |

### 3.4 Improving Long-Term Extraction Quality

If extraction quality is insufficient, these dataset config / prompt improvements can help:

| Improvement                | Where                                      | What to Change                                                                                                                                                            |
| -------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extraction prompt guidance | AMS server config or dataset config        | Add `extractionPrompt` field to dataset config with domain-specific instructions (e.g., "Focus on financial decisions, life events, client preferences, risk indicators") |
| Model upgrade              | `.env` `GENERATION_MODEL` / `FAST_MODEL`   | Switch from `gpt-4o-mini` to `gpt-4o` for higher quality extraction (slower, more expensive)                                                                              |
| Context window size        | `.env` `MEETING_MEMORY_CONTEXT_WINDOW_MAX` | Increase to retain more conversation context before summarization triggers                                                                                                |
| Chunk formatting           | `appendWorkingMemory` handler              | Enrich the message format with speaker role labels and explicit context markers                                                                                           |

---

## 4. Live Suggestions (AI Copilot)

### 4.1 Trigger Timing

| ID      | Test                        | Steps                                             | Expected                                                                                                 |
| ------- | --------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| T-4.1.1 | First trigger at N chunks   | Play transcript; count chunks                     | `generateSuggestion` called when `chunkIndex` reaches `triggerEveryNChunks` (default 5)                  |
| T-4.1.2 | Subsequent triggers         | Continue playback                                 | Generation triggered at chunk 10, 15, 20, etc. (every N chunks)                                          |
| T-4.1.3 | Next button triggers        | Use Next to step through 5 chunks                 | Suggestion triggered at the 5th Next click (chunk index boundary)                                        |
| T-4.1.4 | Mixed play + next           | Play 3 chunks, pause, Next twice more (= 5 total) | Suggestion triggered at chunk 5 regardless of play/next mix                                              |
| T-4.1.5 | No trigger after completion | Complete playback; advance past last chunk        | No further `generateSuggestion` calls; `isPlaybackComplete` blocks generation                            |
| T-4.1.6 | Pause does NOT block        | Pause mid-playback; use Next to advance           | Suggestions still fire at N-chunk intervals during paused state (Next advances chunks)                   |
| T-4.1.7 | Loading existing session    | Load an existing session                          | `listSuggestions` called (not `generateSuggestion`); all prior suggestions + topics populate immediately |
| T-4.1.8 | Rapid Next through one boundary | Click Next N times (e.g., 5) rapidly in quick succession | Exactly one `generateSuggestion` call fires at chunk N; no duplicate calls; suggestion response is captured and appended to the list |
| T-4.1.9 | Rapid Next through multiple boundaries | Click Next 2N+ times (e.g., 12) rapidly before the first generation completes | First trigger fires at chunk N; `isGeneratingRef` blocks the chunk 2N trigger. After first generation completes, `gap >= N` re-triggers at the current chunk index. **Verify**: the intermediate N-boundary suggestion (chunk 2N context) is not lost -- a trigger fires as soon as the first completes |
| T-4.1.10 | No duplicate concurrent calls | Click Next rapidly past a boundary; monitor network | Only one `generateSuggestion` call is in-flight at a time (`isGeneratingRef` guard). No concurrent/duplicate requests |
| T-4.1.11 | Error recovery on rapid clicks | Simulate generation failure (e.g., stop backend briefly); advance past another N boundary | `lastTriggeredIndexRef` rolls back to the previous value on error; next chunk advance re-triggers generation for the same context window. Suggestion is not permanently lost |

### 4.2 Detected Topics

| ID      | Test                           | Steps                                          | Expected                                                                                              |
| ------- | ------------------------------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| T-4.2.1 | Pre-seeded topics              | Start playback on `2026-02-26-google-meet`     | Topics from `meeting.summary.topics` appear as "pending" (circle icon) in the Detected Topics section |
| T-4.2.2 | Topic status updates           | Play through first 10 chunks (REIT discussion) | "REIT rebalancing" topic changes from "pending" to "discussed" (checkmark) with detection timestamp   |
| T-4.2.3 | New topics detected            | Play through chunk ~24 (Maya retirement)       | New topic "Spouse retirement" appears with "new" status and badge                                     |
| T-4.2.4 | Question topics                | Play through chunk ~26 (bond fund question)    | Topic for bond fund question appears with "question" status                                           |
| T-4.2.5 | Topics persist on session load | Load existing session with completed playback  | All topic states (discussed, new, question, pending) correctly restored from `listSuggestions`        |

### 4.3 Suggestion Quality

| ID      | Test                 | Chunk Range                                | Expected Suggestion                                                                      |
| ------- | -------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| T-4.3.1 | REIT recall          | Chunks 5-10 (REIT discussion)              | Type: `topicRecall`; references past meeting; actionable recommendation                  |
| T-4.3.2 | Life event detection | Chunks 20-25 (Maya retirement)             | Type: `lifeEvent`; identifies Maya's retirement; lists financial implications            |
| T-4.3.3 | Question answer      | Chunks 25-30 (bond fund question)          | Type: `questionAnswer`; provides comparison of bond fund vs individual bonds             |
| T-4.3.4 | Null suggestion      | Chunks with routine small talk             | `suggestion: null` returned; no card shown; topics may still update                      |
| T-4.3.5 | Related topics       | Check `relatedTopics` field on suggestions | Each suggestion's `relatedTopics` references actual topics from the detected topics list |

### 4.4 Suggestion Banner

| ID      | Test                        | Steps                          | Expected                                                                                |
| ------- | --------------------------- | ------------------------------ | --------------------------------------------------------------------------------------- |
| T-4.4.1 | Banner updates              | Generate a suggestion          | Banner above tabs shows latest suggestion title + timestamp; animates on new suggestion |
| T-4.4.2 | View Details                | Click "View Details" on banner | Switches to AI Copilot tab; scrolls to the referenced suggestion                        |
| T-4.4.3 | Banner persists across tabs | Switch to Working Memory tab   | Banner still visible above tabs with latest suggestion                                  |
| T-4.4.4 | Empty banner                | Before any suggestions         | Banner shows placeholder text from config                                               |

---

## 5. Summary Views

### 5.1 Pre-Seeded Views

| ID      | Test                       | Steps                               | Expected                                                                                                               |
| ------- | -------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| T-5.1.1 | Views available on startup | Open Summary Views tab              | Pre-seeded views from `config.memoryLabels.summaryViews.views` listed (e.g., "Client Memory Summary", "Session Recap") |
| T-5.1.2 | Views survive reset        | Reset, then check Summary Views tab | Views re-created by `resetLifecycle`; same views available                                                             |
| T-5.1.3 | View metadata              | Check each view's header            | Shows name, source ("long_term"), groupBy field                                                                        |

### 5.2 Compute Summary

| ID      | Test                    | Steps                                                   | Expected                                                                                                                                          |
| ------- | ----------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-5.2.1 | Compute button appears  | After LT extraction complete, open Summary Views tab    | "Compute Summary" button visible for views without a computed partition for the current group                                                     |
| T-5.2.2 | Compute Client Summary  | Click "Compute Summary" on "Client Memory Summary" view | Loading spinner; after 2-10s, computed summary card appears with AI-generated narrative                                                           |
| T-5.2.3 | Summary content quality | Read computed summary                                   | Narrative accurately condenses all extracted LT memories into a coherent paragraph; mentions key facts, decisions, preferences; no hallucinations |
| T-5.2.4 | Compute Session Recap   | Click "Compute Summary" on "Session Recap" view         | Summary scoped to the current session; references specific meeting events                                                                         |
| T-5.2.5 | Memory count shown      | Check computed summary card                             | Shows "Condensed from N long-term memories" or similar memory count                                                                               |
| T-5.2.6 | Computed timestamp      | Check card metadata                                     | Shows computation timestamp                                                                                                                       |

### 5.3 Recompute

| ID      | Test                      | Steps                                                           | Expected                                                                  |
| ------- | ------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| T-5.3.1 | Recompute button          | After computing a summary, check the card                       | Per-card "Recompute" button visible                                       |
| T-5.3.2 | Recompute after more data | Run a second transcript, then recompute "Client Memory Summary" | Summary now includes memories from both sessions; content is richer       |
| T-5.3.3 | Recompute same session    | Recompute "Session Recap" for same session                      | Summary may change slightly (LLM non-determinism) but covers same content |

### 5.4 Multiple Sessions

| ID      | Test                    | Steps                                                              | Expected                                                                          |
| ------- | ----------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| T-5.4.1 | Multiple session recaps | Play transcript A, compute recap; play transcript B, compute recap | Both recaps visible as separate computed summary cards under "Session Recap" view |
| T-5.4.2 | Cross-session summary   | After two transcripts, compute "Client Memory Summary"             | Single narrative covers facts from both sessions                                  |

---

## 6. Redis Metrics Tab

### 6.1 Stat Accuracy

| ID      | Test                 | Steps                               | Expected                                                            |
| ------- | -------------------- | ----------------------------------- | ------------------------------------------------------------------- |
| T-6.1.1 | Working memory stats | Check Redis Metrics during playback | Shows message count and token count matching Working Memory tab     |
| T-6.1.2 | LT memory count      | Check after extraction              | Shows correct count of extracted long-term memories                 |
| T-6.1.3 | Summary count        | Check after computing summaries     | Shows correct count of computed summaries                           |
| T-6.1.4 | Stats update live    | Watch metrics during playback       | Numbers update as data comes in (from hook state, not separate API) |
| T-6.1.5 | Stats after reset    | Reset, then check                   | All counts at zero                                                  |

---

## 7. Chatbot (CopilotKit)

### 7.1 Basic Functionality

| ID      | Test               | Steps                                        | Expected                                                                           |
| ------- | ------------------ | -------------------------------------------- | ---------------------------------------------------------------------------------- |
| T-7.1.1 | Sidebar opens      | Click chatbot toggle                         | Sidebar slides in from right; shows title from config; initial message displayed   |
| T-7.1.2 | Ask a question     | Type "What do we know about James Morrison?" | Agent uses `searchMemories` tool; response mentions stored facts with scope stated |
| T-7.1.3 | Streaming response | Ask a question                               | Response streams in word by word (not all at once)                                 |

### 7.2 Session Routing

| ID      | Test                 | Steps                                                     | Expected                                                                                     |
| ------- | -------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| T-7.2.1 | Session-scoped query | With active session, ask "What happened in this meeting?" | Agent uses `searchMemoriesBySession` with active session ID; response scoped to that session |
| T-7.2.2 | Cross-session query  | Ask "What are all the facts about James?"                 | Agent uses `searchMemories` (all data); response covers multiple sessions                    |
| T-7.2.3 | No active session    | Ask "What happened in this meeting?" with no session      | Agent says "No active session" and falls back to all-data search                             |
| T-7.2.4 | Summary retrieval    | Ask "Give me a complete summary of this client"           | Agent uses `getComputedSummaries`; returns pre-computed narrative if available               |

### 7.3 Long-Term Memory Insights

| ID      | Test                        | Steps                                                               | Expected                                                                                                                                              |
| ------- | --------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-7.3.1 | Semantic memory query       | Ask "What are James Morrison's financial preferences?"              | Agent uses `searchMemories`; response cites semantic memories (preferences, facts) with entities like "James Morrison"; scope stated                  |
| T-7.3.2 | Episodic memory query       | Ask "What key events happened in the last meeting?"                 | Agent uses `searchMemoriesBySession` or `searchMemories`; response cites episodic memories (events with dates)                                       |
| T-7.3.3 | Entity filter               | Ask "What do we know about Emily?"                                  | Agent uses `searchMemories` with `entities: ["Emily"]`; response references only Emily-related memories                                              |
| T-7.3.4 | Topic filter                | Ask "What has been discussed about retirement?"                     | Agent uses `searchMemories` with `topics: ["retirement"]` or text query; response covers all retirement-related facts across sessions                |
| T-7.3.5 | Memory type awareness       | Ask "How many semantic vs episodic memories do we have?"            | Agent uses `searchMemories` (possibly twice with different `memoryType` filters) or interprets results; gives a count breakdown                       |
| T-7.3.6 | Cross-session comparison    | After two transcripts, ask "How did the topics differ between the two meetings?" | Agent calls `listSessions` then `searchMemoriesBySession` for each; compares and contrasts topics                                   |
| T-7.3.7 | No memories match           | Ask "What do we know about cryptocurrency?"                         | Agent uses `searchMemories`; response clearly states no relevant memories found                                                                      |

### 7.4 Working Memory Insights

| ID      | Test                          | Steps                                                        | Expected                                                                                                                                        |
| ------- | ----------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| T-7.4.1 | Session context query         | During playback, ask "What's been discussed so far?"         | Agent uses `getMemoryContext` with active session; response includes working memory context summary and any LT memories                         |
| T-7.4.2 | Token usage query             | Ask "How much of the context window is used?"                | Agent uses `getWorkingMemoryState`; response mentions token count, percentage used, message count                                               |
| T-7.4.3 | Working memory summary        | After context summarization triggers, ask "Summarize the conversation so far" | Agent uses `getMemoryContext` or `getWorkingMemoryState`; response leverages the auto-generated `context` field         |
| T-7.4.4 | List sessions                 | After multiple transcripts, ask "What sessions do we have?" | Agent uses `listSessions`; response lists session IDs with meaningful labels                                                                    |
| T-7.4.5 | Specific session by date      | Ask "What happened in the February 26 meeting?"              | Agent uses `listSessions` to find the matching session, then `getMemoryContext` or `searchMemoriesBySession`; response scoped to that session   |

### 7.5 Summary View Insights

| ID      | Test                           | Steps                                                                 | Expected                                                                                                                           |
| ------- | ------------------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| T-7.5.1 | Retrieve computed summary      | After computing summaries, ask "Give me the client memory summary"    | Agent uses `getComputedSummaries` with `viewName: "Client Memory Summary"`; response returns the pre-computed narrative             |
| T-7.5.2 | List available views           | Ask "What summary views are available?"                               | Agent uses `listSummaryViews`; response lists view names, sources, and groupBy fields                                              |
| T-7.5.3 | Inspect view definition        | Ask "How is the Session Recap summary configured?"                    | Agent uses `listSummaryViews` then `getSummaryView`; response explains groupBy, source, prompt, time window                        |
| T-7.5.4 | No computed summaries          | Before computing any summaries, ask "Give me a summary of this client" | Agent uses `getComputedSummaries`; finds no partitions; responds that no summaries have been computed yet and suggests computing one |
| T-7.5.5 | Session recap vs client summary | Ask "What's the difference between the session recap and client summary?" | Agent uses `listSummaryViews` or `getSummaryView` for both; explains that one is grouped by session, the other by user          |

### 7.6 Dark Theme

| ID      | Test              | Steps                | Expected                                                                        |
| ------- | ----------------- | -------------------- | ------------------------------------------------------------------------------- |
| T-7.6.1 | Theme consistency | Open chatbot sidebar | Dark background (`--dusk-09`), light text, Redis Red accent; Space Grotesk font |

---

## 8. Reset & Lifecycle

### 8.1 Full Reset

| ID      | Test                     | Steps                                   | Expected                                                                                            |
| ------- | ------------------------ | --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| T-8.1.1 | Backend cleanup          | Click "Clear All", confirm              | Backend response shows counts: `sessionsDeleted`, `memoriesDeleted`, `viewsDeleted`, `viewsCreated` |
| T-8.1.2 | WM sessions cleared      | After reset, check sessions dropdown    | No existing sessions listed                                                                         |
| T-8.1.3 | LT memories cleared      | After reset, check Long-Term Memory tab | Zero memories in both SESSION and ALL scope                                                         |
| T-8.1.4 | Summary views re-created | After reset, check Summary Views tab    | Pre-seeded views present (re-created); no computed summaries                                        |
| T-8.1.5 | Copilot stores cleared   | After reset, check AI Copilot tab       | No suggestions, no topics; empty state message                                                      |
| T-8.1.6 | Frontend state clean     | After reset, check all panels           | Transcript panel in IDLE state; explorer shows empty states; no stale data                          |

---

## 9. Edge Cases & Error Handling

### 9.1 Backend Connectivity

| ID      | Test                  | Steps                           | Expected                                                                                                            |
| ------- | --------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| T-9.1.1 | Backend down on load  | Stop backend, load frontend     | Health indicator red / disconnected; config load fails with error UI and retry button                               |
| T-9.1.2 | Backend down mid-play | Stop backend during playback    | UI continues showing chunks (local state); append calls fail silently (fire-and-forget); health indicator turns red |
| T-9.1.3 | Backend recovers      | Restart backend during playback | Health indicator turns green; subsequent appends succeed                                                            |
| T-9.1.4 | AMS down              | Stop agent memory server        | Backend health check fails; working memory operations fail; errors surface in UI                                    |

### 9.2 Rapid User Actions

| ID      | Test                       | Steps                                        | Expected                                                          |
| ------- | -------------------------- | -------------------------------------------- | ----------------------------------------------------------------- |
| T-9.2.1 | Double-click Play          | Click Play twice rapidly                     | Only one session created; no duplicate sessions                   |
| T-9.2.2 | Play while loading         | Click Play before transcript fully loads     | Handled gracefully (button disabled during loading, or queued)    |
| T-9.2.3 | Reset during reset         | Click "Clear All" twice                      | Only one reset fires; loading state prevents double-trigger       |
| T-9.2.4 | Switch transcript mid-play | While playing, select a different transcript | Old playback stops; new transcript loads; requires new Play click |

### 9.3 Data Edge Cases

| ID      | Test                    | Steps                             | Expected                                                                      |
| ------- | ----------------------- | --------------------------------- | ----------------------------------------------------------------------------- |
| T-9.3.1 | Empty transcript        | Create a transcript with 0 chunks | Transcript loads but Play does nothing (no chunks to advance)                 |
| T-9.3.2 | Single chunk transcript | Create a transcript with 1 chunk  | Play -> one chunk displayed -> immediately COMPLETED with `isLastChunk: true` |
| T-9.3.3 | Very long transcript    | Use a transcript with 200+ chunks | Playback runs smoothly; no memory leaks; auto-scroll works; all chunks append |

---

## 10. Visual & UX Polish

### 10.1 Animations

| ID       | Test                     | Steps                  | Expected                                       |
| -------- | ------------------------ | ---------------------- | ---------------------------------------------- |
| T-10.1.1 | Chunk entrance           | Play transcript        | New chunks fade-up; no animation on old chunks |
| T-10.1.2 | Memory card entrance     | Wait for LT extraction | Memory cards animate in (scale + fade)         |
| T-10.1.3 | Suggestion card entrance | Wait for suggestion    | New suggestion cards fade-in in AI Copilot tab |
| T-10.1.4 | Banner animation         | New suggestion arrives | Banner highlights/animates briefly             |

### 10.2 Layout & Theming

| ID       | Test                 | Steps                         | Expected                                                                                            |
| -------- | -------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------- |
| T-10.2.1 | 55/45 split          | Check panel widths            | Transcript panel ~55%, Memory Explorer ~45%                                                         |
| T-10.2.2 | Dark theme           | Verify all surfaces           | Midnight background, Dusk cards, proper contrast                                                    |
| T-10.2.3 | Redis branding       | Check header and footer       | Redis logo, brand title from config, subtitle in footer                                             |
| T-10.2.4 | Config-driven labels | Check all UI text             | All labels, titles, descriptions match `dataset.config.json` values; zero hardcoded display strings |
| T-10.2.5 | Memory type colors   | Check badges and card borders | Semantic = sky blue, Episodic = yellow/volt, Message = dusk gray                                    |

### 10.3 Auto-Scroll Behavior

| ID       | Test                     | Steps                               | Expected                                            |
| -------- | ------------------------ | ----------------------------------- | --------------------------------------------------- |
| T-10.3.1 | Auto-scroll on new chunk | Play transcript, don't touch scroll | Feed scrolls to bottom automatically                |
| T-10.3.2 | Manual scroll preserved  | Scroll up during playback           | Auto-scroll pauses; user stays at scrolled position |
| T-10.3.3 | Resume auto-scroll       | Scroll back to bottom               | Auto-scroll resumes                                 |

---

## Full Scenario: End-to-End Happy Path

This combines all areas into a single walkthrough test:

### Scenario S-1: Complete Demo Flow

1. **Load app** -> Config loads, title and labels from config, health indicator green
2. **Select transcript** -> `2026-02-26-google-meet` from dropdown
3. **Click Play** -> Session created, chunks start streaming at 2s intervals
4. **Watch AI Copilot tab** (auto-activated) -> Topics pre-seeded as "pending"
5. **At chunk ~5** -> First suggestion triggers (topic recall about REITs)
6. **At chunk ~10** -> Topics update: REIT "discussed"
7. **Switch to Working Memory tab** -> Token count growing, messages visible, banner still shows latest suggestion
8. **At chunk ~24** -> Life event suggestion: Maya's retirement; banner updates
9. **(Long transcript only) Check LT tab mid-playback** -> For transcripts with 50+ chunks, AMS may auto-extract memories when the context window fills. LT tab shows early memories even while playback is running. Polling continues throughout -- does NOT stop on first detection.
10. **Playback completes** -> Status COMPLETED, `isLastChunk` sent, explicit extraction triggered
11. **Wait for post-completion polling** -> Polling continues for up to 60s (`EXTRACTION_MAX_WAIT_MS`) after completion, auto-detecting the explicit extraction results. No manual Refresh needed.
12. **Check LT memories** -> 6-10 memories grouped by type (semantic, episodic); topics and entities tagged; all extraction rounds captured automatically
13. **Switch to Summary Views** -> Pre-seeded views visible; "Compute Summary" buttons available
14. **Click "Compute Summary" on Client Memory Summary** -> AI generates narrative; computed card appears
15. **Click "Compute Summary" on Session Recap** -> Session-specific narrative appears
16. **Check Redis Metrics** -> Shows message count, LT memory count, summary count
17. **Open chatbot** -> Ask "What happened in this meeting?" -> Session-scoped answer
18. **Ask chatbot** -> "What do we know about James?" -> All-data answer
19. **Click "Clear All"** -> Confirm dialog, reset completes, clean slate
20. **Verify clean state** -> All tabs empty, sessions cleared, views re-created

### Scenario S-2: Step-Through (Next Button Only)

1. Select transcript, click Next 5 times -> 5 chunks shown, status PAUSED
2. Verify suggestion triggers at chunk 5
3. Click Play -> Playback continues from chunk 6
4. Pause at chunk 15 -> 15 chunks visible
5. Click Next 3 times -> 18 chunks visible, 3 append calls made
6. Click Play -> Continues from chunk 19
7. Let it complete -> Full extraction triggered

### Scenario S-3: Load Existing Session

1. Complete a full playback (Scenario S-1 through step 14)
2. Reload the page
3. Select the completed session from "Load Existing Session" dropdown
4. Verify: full transcript displayed instantly, all LT memories loaded, all suggestions/topics restored, summary views show computed summaries
5. Chatbot works with loaded session context

### Scenario S-4: Multiple Transcripts

1. Play `2026-02-26-google-meet` to completion, compute summaries
2. Reset is NOT clicked (session and memories remain)
3. Select `2026-01-15-phone` transcript
4. Play to completion, wait for extraction
5. Check LT Memory (ALL scope): memories from both sessions
6. Recompute "Client Memory Summary": now includes facts from both meetings
7. Check "Session Recap" view: two separate recap cards (one per session)

---

## Automation Strategy

### Recommended Approach: Playwright E2E + API Integration Tests

Given this is a demo application with complex UI interactions, LLM-dependent content, and real backend services, the testing strategy should be layered:

### Layer 1: API Integration Tests (Backend)

**Tool:** Vitest + native `fetch`

**What to test:**

- All API endpoints with real AMS backend (not mocked)
- Request/response contracts
- Session lifecycle (create -> append N chunks -> get WM -> search LT -> compute summary -> reset)
- Error responses for invalid inputs
- Timing: extraction completes within `EXTRACTION_MAX_WAIT_MS`

**Example test flow:**

```typescript
// test: full session lifecycle
const config = await apiPost("/api/getDataset");
const transcripts = await apiPost("/api/listTranscripts");
const transcript = await apiPost("/api/getTranscript", {
  transcriptId: transcripts.transcripts[0].id,
});
const session = await apiPost("/api/createWorkingMemory", {
  transcriptId: transcript.meeting.id,
});

for (const [i, chunk] of transcript.chunks.entries()) {
  await apiPost("/api/appendWorkingMemory", {
    sessionId: session.sessionId,
    chunk,
    isLastChunk: i === transcript.chunks.length - 1,
  });
}

// Poll for LT memories
let memories;
for (let attempt = 0; attempt < 12; attempt++) {
  await sleep(5000);
  memories = await apiPost("/api/searchLongTermMemoryBySession", {
    sessionId: session.sessionId,
  });
  if (memories.total > 0) break;
}
expect(memories.total).toBeGreaterThan(0);

// Compute summary
const views = await apiPost("/api/listSummaryViews");
const clientView = views.views.find((v) => v.name === "Client Memory Summary");
const summary = await apiPost("/api/computeSummary", {
  viewId: clientView.viewId,
  group: { user_id: config.userId },
});
expect(summary.summary).toBeTruthy();
expect(summary.memoryCount).toBeGreaterThan(0);
```

**Scope:** ~15-20 tests covering all API routes and the full lifecycle.

### Layer 2: E2E UI Tests (Frontend + Backend)

**Tool:** Playwright

**What to test:**

- Page load and config rendering
- Transcript selection and playback controls (play, pause, next, speed)
- Chunk rendering and auto-scroll
- Tab switching and data display
- Suggestion banner and AI Copilot tab
- Summary computation flow
- Reset flow
- Chatbot sidebar open/close and basic interaction

**Key Playwright patterns:**

```typescript
// Wait for chunk count to reach N
await expect(page.locator(".transcript-chunk")).toHaveCount(5, {
  timeout: 15000,
});

// Check status chip text
await expect(page.locator(".playback-controls__status")).toHaveText("Playing");

// Wait for LT memories to appear
await expect(page.locator(".memory-card")).toHaveCount.greaterThan(0, {
  timeout: 60000,
});

// Verify suggestion banner
await expect(page.locator(".suggestion-banner")).toContainText(
  /detected|recall|event/i,
);
```

**Scope:** ~10-15 test files covering scenarios S-1 through S-4.

### Layer 3: Content Quality Spot Checks (Semi-Automated)

**Tool:** Vitest + OpenAI API (or manual review)

**What to test:**

- LT extraction quality: run a fixed transcript, verify expected facts are extracted
- Summary quality: compute summary, verify it mentions key topics
- Suggestion quality: generate suggestions at known chunk ranges, verify relevance

**Approach:** These are inherently non-deterministic (LLM output varies). Use assertions like:

- `expect(memories.map(m => m.text).join(' ')).toContain('retirement')` (loose matching)
- `expect(summary.summary.length).toBeGreaterThan(100)` (minimum content)
- Score-based: use a separate LLM call to evaluate if extracted content is relevant

**Scope:** ~5-8 quality tests, run with a higher timeout, flagged as "flaky-allowed" in CI.

### Layer 4: Visual Regression (Optional)

**Tool:** Playwright screenshots + Percy/Chromatic

**What to test:**

- Dark theme consistency
- Layout at 1920x1080
- Memory type badge colors
- Animations (capture before/after states)

### Test Infrastructure

```
tests/
├── api/                        # Layer 1: API integration tests
│   ├── dataset.test.ts
│   ├── transcript.test.ts
│   ├── working-memory.test.ts
│   ├── long-term-memory.test.ts
│   ├── summary-views.test.ts
│   ├── suggestions.test.ts
│   ├── lifecycle.test.ts
│   └── full-lifecycle.test.ts
│
├── e2e/                        # Layer 2: Playwright E2E tests
│   ├── playback.spec.ts        # Play, pause, next, speed, completion
│   ├── working-memory.spec.ts  # WM tab during and after playback
│   ├── long-term-memory.spec.ts # LT tab after extraction
│   ├── suggestions.spec.ts     # AI Copilot tab + banner
│   ├── summary-views.spec.ts   # Compute + display summaries
│   ├── chatbot.spec.ts         # CopilotKit sidebar
│   ├── reset.spec.ts           # Full reset flow
│   ├── load-session.spec.ts    # Load existing session
│   └── full-demo.spec.ts       # End-to-end happy path (S-1)
│
├── quality/                    # Layer 3: Content quality checks
│   ├── extraction-quality.test.ts
│   ├── summary-quality.test.ts
│   └── suggestion-quality.test.ts
│
└── helpers/
    ├── api-client.ts           # Shared API helper for tests
    ├── test-fixtures.ts        # Known transcript IDs, expected data
    └── wait-helpers.ts         # Polling utilities for async operations
```

### Running Tests

```bash
# API integration tests (requires backend + AMS running)
npm run test:api

# E2E tests (requires full stack running)
npm run test:e2e

# Quality checks (requires full stack + LLM access)
npm run test:quality

# All tests
npm run test:all
```

### CI Considerations

- **API tests**: Run in CI with Docker Compose (redis + AMS + backend)
- **E2E tests**: Run with Playwright in CI; use `docker compose up` for infrastructure
- **Quality tests**: Run nightly (not on every PR) due to LLM cost and non-determinism
- **Timeouts**: LT extraction can take 15-30s; summary computation 5-15s; set test timeouts accordingly (60s+ for lifecycle tests)

---

## Priority Order for Test Implementation

| Priority | What                                          | Why                                                    |
| -------- | --------------------------------------------- | ------------------------------------------------------ |
| P0       | API integration tests (Layer 1)               | Foundation; validates backend contracts; fast to write |
| P1       | E2E playback tests (play/pause/next/complete) | Core UX; most likely to break during changes           |
| P1       | E2E reset test                                | Critical for demo reliability                          |
| P2       | E2E working memory + LT memory tests          | Key demo moments; validates polling and extraction     |
| P2       | E2E suggestion tests                          | Complex trigger logic; high regression risk            |
| P3       | E2E summary view tests                        | Less frequently changing; compute is straightforward   |
| P3       | Quality spot checks                           | Important but non-deterministic; run less frequently   |
| P4       | Chatbot tests                                 | Separate system; lower regression risk                 |
| P4       | Visual regression                             | Nice to have; not blocking                             |

---

## Appendix: Known Code Observations for Testers

These are implementation details discovered during code review that testers should be aware of:

1. **Append errors are silent**: `useTranscriptPlayback` catches append failures with `console.error` only; the hook's `error` state is never set on append failure. Playback continues even if appends fail.

2. **LT polling should run throughout playback + grace period (BUG-1)**: The current code stops polling on first `total > 0` detection, which is incorrect. After the BUG-1 fix (`docs/dev-pending-tasks.md`), polling should continue throughout playback and for `EXTRACTION_MAX_WAIT_MS` (60s) after completion, auto-detecting all extraction rounds. Tests in section 3.1 are written against the expected (post-fix) behavior.

3. **AMS triggers extraction autonomously**: The Agent Memory Server auto-extracts long-term memories whenever it compresses/summarizes the working memory context window, independent of the app's explicit `longTermMemoryStrategy: DISCRETE` flag on the last chunk. This means LT memories can appear at any point during playback for long transcripts. Tests should account for non-deterministic extraction timing.

4. **Constants for post-completion polling**: `LT_MEMORY_POLL_AFTER_EXTRACTION_MS` (5s) and `EXTRACTION_MAX_WAIT_MS` (60s) are currently exported but unused. After BUG-1 fix, these will control the post-completion polling interval and grace period. Tests in section 3.1 reference these values.

5. **`loadAll` does not call API**: When loading an existing session, `playback.loadAll()` displays all chunks locally but does not re-call `appendWorkingMemory`. The working memory state is already on the server from the original playback.

6. **Suggestion trigger is chunk-index-based, not timer-based**: The `useLiveSuggestions` hook triggers based on chunk index gaps, not time intervals. Both Play (interval) and Next (manual) increment the chunk index.

7. **`isGenerating` in dependency array**: The live suggestions `useEffect` includes `isGenerating` in its dependency array, which causes extra evaluations when the flag toggles. This is by design but can cause confusion during debugging.

8. **Summary view `group` construction**: The `summary-views-tab` builds the `group` object from the view's `groupBy` field using a key mapping (`user_id` -> `userId` prop, `session_id` -> `sessionId` prop, `namespace` -> `namespace` prop). If any required key value is missing, the "Compute Summary" button is hidden.
