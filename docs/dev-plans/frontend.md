# Frontend

## Overview

The frontend is a Next.js 14 App Router application (static export) built with React, TypeScript, MUI components, and CopilotKit. It provides a two-panel layout: a transcript playback panel (left) and a memory explorer panel (right), plus a CopilotKit chatbot sidebar.

## Tech Stack

- **Next.js 14** (App Router, static export via `output: "export"`)
- **React 18** (hooks-only, no class components)
- **TypeScript** (strict mode)
- **MUI** (Material UI for Tabs, Select, Button, Dialog, CircularProgress)
- **CopilotKit** (`@copilotkit/react-core`, `@copilotkit/react-ui`) for chatbot sidebar
- **CSS** (pure CSS with nesting, CSS variables, component-scoped classes)

## Page Structure (`app/page.tsx`)

The single page (`DemoPage`) orchestrates:

1. **Loading state**: Shows spinner while fetching dataset config
2. **Error state**: Shows retry button if config fails to load
3. **Main layout**:
   - `CopilotSidebar` wrapper (chatbot, defaults to closed)
   - Header with branding title
   - Two-panel grid:
     - Left: `TranscriptPanel` (playback controls + transcript feed)
     - Right: `MemoryExplorerPanel` (tabbed memory views)
   - Footer

**Key state managed at page level:**
- `sessionId` -- currently active session
- `currentChunkIndex` -- playback progress
- `isPlaying` / `isPlaybackComplete` -- playback status

**CopilotKit readables** (injected into chatbot context):
- Active session ID
- User ID

## Components

### Business Components (`components/business/`)

#### Transcript Panel (`transcript-panel/`)

| File | Purpose |
|------|---------|
| `transcript-panel.component.tsx` | Main orchestrator: transcript selection, session management, playback control, reset dialog |
| `toolbar.component.tsx` | Transcript dropdown, speed selector, play/pause/next/reset buttons |
| `transcript-feed.component.tsx` | Scrollable feed of displayed transcript chunks |
| `transcript-chunk.component.tsx` | Single chunk display with speaker, timestamp, text |
| `playback-controls.component.tsx` | Bottom bar with progress (chunk X/Y), status, health dot |
| `use-transcript-playback.ts` | Playback state machine hook (idle/loading/playing/paused/completed) |
| `use-backend-health.ts` | Periodic health check hook |

**Playback flow:**
1. User selects transcript from dropdown
2. Clicks Play -> creates session (via API), starts interval-based chunk appending
3. Each chunk calls `appendWorkingMemory` API (stores to cloud RAM)
4. Chunks appear in the transcript feed as they're played
5. "Load All" for resumed sessions displays all chunks instantly

#### Memory Explorer Panel (`memory-explorer-panel/`)

| File | Purpose |
|------|---------|
| `memory-explorer-panel.component.tsx` | Tabbed container: AI Copilot, Session Memory, Long-Term Memory, Redis Metrics |
| `working-memory-tab.component.tsx` | Shows session events + summary (if available) |
| `working-memory-summary.component.tsx` | Renders session summary when present |
| `long-term-memory-tab.component.tsx` | Shows LTMs grouped by type (episodic/semantic/message), scope toggle (session/all) |
| `memory-card.component.tsx` | Individual LTM card with type badge, text, metadata |
| `redis-metrics-tab.component.tsx` | Shows event count, LTM counts, session/all totals |
| `use-working-memory.ts` | Polls session memory during playback |
| `use-long-term-memory.ts` | Fetches LTMs by session or all, with scope toggle |

**AI Copilot sub-components (`ai-copilot/`):**
| File | Purpose |
|------|---------|
| `ai-copilot-tab.component.tsx` | Full suggestions + detected topics view |
| `suggestion-banner.component.tsx` | Banner showing latest suggestion |
| `suggestion-card.component.tsx` | Individual suggestion display |
| `detected-topics.component.tsx` | Topic list with status badges |
| `use-suggestions.ts` | Triggers suggestion generation every N chunks |

### Core Components (`components/core/`)

Reusable UI primitives:

| Component | Purpose |
|-----------|---------|
| `SectionCard` | Titled card container with description |
| `EmptyState` | Placeholder for empty content areas |
| `ConfirmDialog` | MUI Dialog with confirm/cancel actions |
| `DropdownIcon` | Custom chevron icon for Select components |
| `Toast` | Snackbar notification system |
| `MemoryTypeBadge` | Colored badge for memory types (episodic/semantic/message) |
| `StatusDot` | Health/status indicator dot |

## Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useDatasetConfig` | `hooks/use-dataset-config.ts` | Fetches dataset config on mount, provides loading/error/retry |

Inline hooks (co-located with components):
- `useTranscriptPlayback` -- playback state machine
- `useBackendHealth` -- periodic health polling
- `useWorkingMemory` -- session memory polling
- `useLongTermMemory` -- LTM fetching with scope
- `useSuggestions` -- suggestion generation triggers

## Services (`services/api.service.ts`)

Centralized API client. All endpoints use `apiPost<T>()` which:
1. POSTs JSON to `API_BASE_URL + path`
2. Parses `ApiResponse<T>` (expects `{ data, error }`)
3. Emits `CustomEvent("api-error")` on failure (caught by Toast)

Key functions: `fetchDatasetConfig`, `fetchTranscripts`, `fetchTranscript`, `createWorkingMemory`, `appendChunk`, `fetchWorkingMemory`, `searchLongTermMemory`, `generateSuggestion`, `listSuggestions`, `resetDemo`.

## Types (`types/`)

| File | Exports |
|------|---------|
| `dataset-config.types.ts` | `DatasetConfig`, `UseDatasetConfigResult` |
| `transcript.types.ts` | `TranscriptChunk`, `TranscriptData`, `TranscriptSummary`, `TranscriptMeeting` |
| `memory.types.ts` | `SessionMemoryData`, `SessionEvent`, `LongTermMemory`, `AppendResult`, `CreateSessionResponse` |
| `api.types.ts` | `ApiResponse<T>`, `ResetResult`, `LtSearchResponse`, `ListSessionsResponse`, etc. |
| `suggestion.types.ts` | `Suggestion`, `DetectedTopic`, `GenerateSuggestionResponse`, `ListSuggestionsResponse` |

## Constants (`constants/app.constants.ts`)

Key groups:
- **API URLs**: `API_BASE_URL`, `COPILOTKIT_RUNTIME_URL`
- **Polling intervals**: `WORKING_MEMORY_POLL_INTERVAL_MS` (3s), `EXTRACTION_POLL_INTERVAL_MS` (5s)
- **Tab IDs**: `DEMO_TAB` (ai-copilot, working-memory, long-term-memory, redis-metrics)
- **Playback**: `PLAYBACK_STATUS`, speeds, interval
- **Memory types**: `MEMORY_TYPE` (semantic/episodic/message)
- **UI constants**: `LAST_MESSAGES_COUNT` (5), `MAX_MEMORY_TEXT_LENGTH` (200), etc.

## Styling

- **Approach**: Pure CSS with nesting, component-scoped BEM-like classes
- **Theme**: CSS variables defined in `styles/` (colors, spacing, typography)
- **Dark theme**: Midnight/space palette with accent colors (yellow, sky-blue, etc.)
- **No Tailwind**: All styles are custom CSS, no utility-class frameworks
- **CopilotKit theme**: Custom overrides in `styles/copilotkit-theme.css`

## Data Flow

```
page.tsx (state owner)
  │
  ├─ useDatasetConfig() ───────► fetchDatasetConfig() ──► backend /getDataset
  │
  ├─ TranscriptPanel
  │   ├─ fetchTranscripts() ───► backend /listTranscripts
  │   ├─ fetchTranscript() ────► backend /getTranscript
  │   ├─ createWorkingMemory() ► backend /createWorkingMemory
  │   ├─ appendChunk() ────────► backend /appendWorkingMemory (each chunk)
  │   └─ resetDemo() ─────────► backend /resetLifecycle
  │
  └─ MemoryExplorerPanel
      ├─ useWorkingMemory ─────► fetchWorkingMemory() (polling every 3s)
      ├─ useLongTermMemory ────► searchLongTermMemory[BySession]()
      └─ useSuggestions ───────► generateSuggestion() (every N chunks)
```

## Dataset-Driven UI

All labels, branding, roles, suggestion types, and playback config come from `DatasetConfig` (loaded from backend). The frontend never hardcodes persona-specific text. Key config sections:

- `branding`: title, subtitle, accent color, footer
- `memoryLabels`: tab titles and descriptions
- `roles` + `roleMapping`: speaker display styles
- `participants`: speaker name/title/org
- `playbackDefaults`: interval, speed options
- `toolbar` / `statusLabels`: button and status text
- `suggestions`: trigger config, type definitions, labels

## Key UI Behaviors

1. **LTM tab hides empty groups**: Memory type sections (semantic, episodic, message) are only rendered when they contain items.
2. **Session summary**: Conditionally rendered when session memory contains a `summary` field.
3. **Suggestions trigger**: Every N chunks during playback, a suggestion generation is triggered.
4. **Auto-scroll**: Transcript feed auto-scrolls during playback.
5. **Session resume**: Previous sessions can be loaded from the session dropdown.
6. **Health indicator**: Green/red dot in playback controls shows backend connectivity.
