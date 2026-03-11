# Meeting Memory Demo -- Frontend Development Plan (V1)

## Goal

Build a Next.js frontend that powers the **Memory Exploration Demo** for the Redis Released flagship event. V1 focuses on two visual experiences derived from Screen 5 (Transcript History) and Screen 6 (Memory Explorer) of the [full UX plan](./plan.md):

1. **Live Transcript Panel** -- transcript chunks appear at timed intervals (simulating a real meeting), visually scrolling like a live call transcript.
2. **Memory Explorer Panel** -- a multi-section view showing every memory type created by the Redis Agent Memory Server: working memory state, long-term extracted memories, computed summaries, and working memory context summary.

**Key design decisions:**

1. **Frontend-driven playback:** The frontend owns the entire playback loop. It fetches the full transcript in one API call, displays chunks at intervals using `setInterval`, and POSTs each chunk to the backend. No SSE, no WebSockets -- pure REST API calls.
2. **Config-driven UI:** Every label, title, speaker name, button text, and description in the UI comes from a `dataset.config.json` file served by the backend via `POST /api/getDataset`. Zero hardcoded display strings. This makes the demo instantly reusable across datasets (wealth advisor, SDR advisor, personal assistant, etc.) without any code changes.
3. **Clear All & Restart:** A prominent button in the toolbar calls `POST /api/resetLifecycle` to wipe all memories in the backend, then resets the frontend state to idle -- ready for a fresh demo run.

The frontend consumes the backend's **POST-only REST API** defined in [dev-backend-plan.md](./dev-backend-plan.md). All backend calls are `POST /api/{route}` with JSON body params. All responses are wrapped in `{ data, error }` by `cau-api-server`. The dataset config schema is defined in [data/wealth-advisor/dataset.config.json](../data/wealth-advisor/dataset.config.json).

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  Next.js App (App Router)                                        │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  DemoPage (/)                                               │ │
│  │                                                              │ │
│  │  ┌──────────────────────┐  ┌──────────────────────────────┐ │ │
│  │  │  TranscriptPanel     │  │  MemoryExplorerPanel          │ │ │
│  │  │  (left side)         │  │  (right side, tabbed)         │ │ │
│  │  │                      │  │                               │ │ │
│  │  │  - PlaybackControls  │  │  Tab: Working Memory          │ │ │
│  │  │  - TranscriptFeed    │  │  Tab: Long-Term Memories      │ │ │
│  │  │  - TranscriptChunk   │  │  Tab: Summary Views           │ │ │
│  │  │                      │  │  Tab: Redis Under the Hood    │ │ │
│  │  └──────────────────────┘  └──────────────────────────────┘ │ │
│  │                                                              │ │
│  │  ┌──────────────────────────────────────────────────────────┐│ │
│  │  │  DemoToolbar (top)                                       ││ │
│  │  │  - Transcript selector, Play/Stop/Reset, Speed, Status  ││ │
│  │  └──────────────────────────────────────────────────────────┘│ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Hooks:                                                          │
│  - useDatasetConfig (POST /api/getDataset on mount)             │
│  - useTranscriptPlayback (setInterval + POST /api calls)         │
│  - useWorkingMemory (polling via POST)                           │
│  - useLongTermMemory (fetch-on-demand via POST)                  │
│  - useSummaryViews (pre-created view + on-demand)                │
│  - useBackendHealth (GET /health periodic check)                 │
└──────────────────────────────────────────────────────────────────┘
         │
         │ HTTP (POST-only API, { data, error } envelope)
         ▼
┌──────────────────────┐
│  cau-api-server      │
│  http://localhost:3001│
└──────────────────────┘
```

---

## Project Structure

```
examples/meeting-memory/frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout (fonts, metadata, global styles)
│   │   ├── page.tsx                    # DemoPage -- main demo view
│   │   └── globals.css                 # Global CSS variables, resets, base styles
│   ├── components/
│   │   ├── demo-toolbar.component.tsx          # Top bar: transcript picker, play/stop/reset, speed
│   │   ├── transcript-panel.component.tsx      # Left panel container
│   │   ├── transcript-feed.component.tsx       # Scrollable transcript chunk list
│   │   ├── transcript-chunk.component.tsx      # Single chunk bubble (speaker, timestamp, text)
│   │   ├── playback-controls.component.tsx     # Progress bar and chunk counter
│   │   ├── memory-explorer-panel.component.tsx # Right panel container with tabs
│   │   ├── working-memory-tab.component.tsx    # Working memory state display
│   │   ├── working-memory-summary.component.tsx # Context summary sub-section
│   │   ├── long-term-memory-tab.component.tsx  # Long-term memories grouped by type
│   │   ├── memory-card.component.tsx           # Single long-term memory card
│   │   ├── summary-views-tab.component.tsx     # Summary views + computed summaries
│   │   ├── computed-summary-card.component.tsx  # Single computed summary card
│   │   ├── redis-metrics-tab.component.tsx     # "Under the Hood" stats display
│   │   ├── memory-type-badge.component.tsx     # Colored badge for semantic/episodic/message
│   │   ├── status-indicator.component.tsx      # Connection/health status dot
│   │   └── empty-state.component.tsx           # Empty state placeholder per section
│   ├── hooks/
│   │   ├── use-dataset-config.ts       # POST /api/getDataset on mount, provides config to all components
│   │   ├── use-transcript-playback.ts  # Interval-based playback + POST /api/appendWorkingMemory per chunk
│   │   ├── use-working-memory.ts       # Polling hook via POST /api/getWorkingMemory
│   │   ├── use-long-term-memory.ts     # Fetch hook via POST /api/searchLongTermMemory
│   │   ├── use-summary-views.ts        # Pre-created view + computeSummary + getComputedSummaries
│   │   └── use-backend-health.ts       # GET /health check hook
│   ├── services/
│   │   └── api.service.ts              # Centralized fetch wrapper for backend API
│   ├── types/
│   │   ├── dataset-config.types.ts     # DatasetConfig type (mirrors dataset.config.json schema)
│   │   ├── transcript.types.ts         # Transcript data types
│   │   ├── memory.types.ts             # Working memory, LT memory, summary view types
│   │   └── api.types.ts                # API request/response envelope types
│   ├── constants/
│   │   └── app.constants.ts            # API base URL, intervals, tab IDs
│   └── styles/
│       ├── variables.css               # CSS custom properties (colors, spacing, typography)
│       ├── transcript-panel.css        # Transcript-specific styles
│       ├── memory-explorer.css         # Memory explorer-specific styles
│       ├── toolbar.css                 # Toolbar styles
│       └── components.css              # Shared component styles (cards, badges, tabs)
├── public/
│   └── redis-logo.svg                  # Redis branding asset
├── package.json
├── next.config.js
└── tsconfig.json
```

---

## Tech Stack

| Tool | Version | Purpose |
|---|---|---|
| Next.js | 15.x | App Router, React 19, SSR/CSR |
| React | 19.x | UI rendering |
| TypeScript | 5.x | Type safety |
| Pure CSS | -- | Custom properties, no CSS-in-JS |
| `@mui/material` | 6.x | Material Design components (tabs, chips, buttons, cards, icons) |
| `@mui/icons-material` | 6.x | Material icons |

### Why MUI?

- Polished tabs, chips, badges, tooltips out of the box -- essential for the tabbed Memory Explorer
- Consistent Material Design look appropriate for a professional event demo
- Only used for structural components (Tabs, Card, Chip, Button, IconButton, Tooltip, LinearProgress); layout and visual theming done in pure CSS custom properties

---

## Package Dependencies (`package.json`)

```json
{
  "name": "meeting-memory-frontend",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start --port 3000"
  },
  "dependencies": {
    "next": "^15.3.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "@mui/material": "^6.6.0",
    "@mui/icons-material": "^6.6.0",
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.0"
  },
  "devDependencies": {
    "@types/react": "^19.1.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.9.3"
  }
}
```

---

## Constants (`app.constants.ts`)

Only technical/polling constants live here. **All display strings, labels, titles, button text, speed options, and status labels come from the dataset config** (fetched via `GET /api/dataset`).

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const WORKING_MEMORY_POLL_INTERVAL_MS = 3000;
const LT_MEMORY_POLL_AFTER_EXTRACTION_MS = 5000;
const EXTRACTION_POLL_INTERVAL_MS = 5000;
const EXTRACTION_MAX_WAIT_MS = 60000;

const DemoTab = {
  WORKING_MEMORY: "working-memory",
  LONG_TERM_MEMORY: "long-term-memory",
  SUMMARY_VIEWS: "summary-views",
  REDIS_METRICS: "redis-metrics",
} as const;

const PlaybackStatus = {
  IDLE: "idle",
  LOADING: "loading",
  PLAYING: "playing",
  COMPLETED: "completed",
  EXTRACTING: "extracting",
  READY_TO_EXPLORE: "ready-to-explore",
  ERROR: "error",
} as const;
```

**What moved to `dataset.config.json` (fetched at runtime):**
- `PlaybackSpeed` values and labels -> `config.playbackDefaults.speeds[]`
- Default playback interval -> `config.playbackDefaults.intervalMs`
- Tab titles -> `config.memoryLabels.workingMemory.title`, etc.
- Status chip text -> `config.statusLabels`
- Toolbar button labels -> `config.toolbar`
- All section descriptions -> `config.memoryLabels.*.description`

---

## UI Design

### Layout: Split Panel (55/45)

```
All titles, labels, and descriptions below are read from `config.*` -- never hardcoded.

┌──────────────────────────────────────────────────────────────────────────┐
│  {config.branding.title}     {config.branding.subtitle}   [Health: OK]  │
├──────────────────────────────────────────────────────────────────────────┤
│  {config.toolbar.transcriptDropdownLabel}: [Feb 26 Google Meet ▾]       │
│  {config.toolbar.speedLabel}: [1x ▾]                                    │
│  [▶ {config.toolbar.playLabel}]  [🗑 {config.toolbar.resetLabel}]       │
├──────────────────────────────┬───────────────────────────────────────────┤
│                              │                                           │
│  {config.transcriptPanel     │  MEMORY EXPLORER                          │
│   .title}                    │                                           │
│                              │  ┌───────────────────────────────────┐    │
│  ┌────────────────────────┐  │  │ [{config.memoryLabels              │    │
│  │ 00:00:05               │  │  │   .workingMemory.title}]           │    │
│  │ {config.roles.rm       │  │  │ [{config.memoryLabels              │    │
│  │  .shortLabel}: Sarah   │  │  │   .longTermMemory.title}]          │    │
│  │ Hi James, good to see  │  │  │ [{config.memoryLabels              │    │
│  │ you...                 │  │  │   .summaryViews.title}]             │    │
│  ├────────────────────────┤  │  │ [{config.memoryLabels              │    │
│  │ 00:00:10               │  │  │   .metrics.title}]                 │    │
│  │ {config.roles.client   │  │  └───────────────────────────────────┘    │
│  │  .shortLabel}: James   │  │                                           │
│  │ Hey Sarah, yeah,       │  │  ┌───────────────────────────────────┐    │
│  │ everything's clear...  │  │  │                                   │    │
│  ├────────────────────────┤  │  │  (active tab content)             │    │
│  │                        │  │  │                                   │    │
│  │  ▼ auto-scrolling      │  │  │  {config.memoryLabels             │    │
│  └────────────────────────┘  │  │   .[activeTab].description}       │    │
│                              │  │                                   │    │
│  Chunks: 12/56 | 22%        │  └───────────────────────────────────┘    │
│                              │  Operations: 24 | Avg: 42ms              │
├──────────────────────────────┴───────────────────────────────────────────┤
│  {config.branding.footerText}                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Component Specifications

### 1. DemoPage (`page.tsx`)

The root page component. Orchestrates all state and passes it down. **All display strings come from `datasetConfig`**, never hardcoded.

**State managed at this level:**
- `datasetConfig` -- the active dataset configuration (from `GET /api/dataset`, fetched once on mount via `useDatasetConfig`)
- `selectedTranscriptId` -- which transcript file to use
- `transcriptData` -- full transcript JSON (fetched once on selection)
- `sessionId` -- current working memory session ID (from backend)
- `playbackStatus` -- idle / loading / playing / completed / extracting / ready-to-explore
- `activeTab` -- which Memory Explorer tab is selected
- `metrics` -- client-side operation counters and latency tracking

Note: `userId` and `namespace` are read from `datasetConfig.userId` and `datasetConfig.namespace` -- not separate state variables.

**Lifecycle:**
1. On mount: fetch dataset config from `POST /api/getDataset` (via `useDatasetConfig`). Show loading spinner until config arrives. Config includes `defaultSummaryViewId`. All labels render from this config.
2. On config loaded: fetch available transcripts from `POST /api/listTranscripts`
3. On transcript selection: fetch full transcript via `POST /api/getTranscript { transcriptId }`, store in state
4. On Play: call `POST /api/createWorkingMemory { transcriptId }` to create session, then start `useTranscriptPlayback`
5. During playback: `useTranscriptPlayback` displays chunks + calls `POST /api/appendWorkingMemory` per chunk
6. On complete: status transitions to `extracting`, polls for long-term memories via `POST /api/searchLongTermMemory`
7. When memories appear: status transitions to `ready-to-explore`. Quick summary available immediately via `POST /api/computeSummary` using `defaultSummaryViewId` from config -- no need to create a view first.
8. On "Clear All Memories & Restart" (reset button): call `POST /api/resetLifecycle`, clear all frontend state (session, chunks, metrics, memories), return to `idle`. Backend re-creates the default summary view, so `defaultSummaryViewId` updates on next `dataset.get` call.

### 2. DemoToolbar (`demo-toolbar.component.tsx`)

Top horizontal bar with demo controls. **All button labels and status text come from `datasetConfig.toolbar` and `datasetConfig.statusLabels`.**

**Props include `datasetConfig: DatasetConfig`** -- every label is rendered from config, never hardcoded.

| Element | Config source | Type | Behavior |
|---|---|---|---|
| Transcript dropdown | `config.toolbar.transcriptDropdownLabel` | MUI Select | Lists available transcripts from `POST /api/listTranscripts` |
| Speed dropdown | `config.toolbar.speedLabel`, `config.playbackDefaults.speeds[]` for options | MUI Select | Options come from `config.playbackDefaults.speeds` (label + intervalMs pairs) |
| Play button | `config.toolbar.playLabel` | MUI IconButton (PlayArrow) | Starts playback, disabled while playing |
| Stop button | `config.toolbar.stopLabel` | MUI IconButton (Stop) | Stops playback mid-stream, keeps data |
| Clear All button | `config.toolbar.resetLabel` | MUI Button (DeleteSweep icon, red/destructive) | **Prominently styled.** Calls `POST /api/resetLifecycle`, then clears all frontend state, returns to idle. Confirmation dialog: "This will delete all working memory, long-term memories, and summary views for this dataset. Continue?" |
| Status chip | `config.statusLabels[playbackStatus]` | MUI Chip | Shows config-driven text for each status (e.g., `config.statusLabels.playing` = "Playing") |
| Health indicator | -- | Custom dot | Green/red based on `GET /health` (built-in cau-api-server endpoint) |

**Clear All button details:**
- Visible at all times (not just after playback)
- Uses a destructive visual style (red outline or filled red)
- Shows a brief confirmation dialog before proceeding
- On confirm: `POST /api/resetLifecycle` -> on success -> reset all frontend state (session, chunks, metrics, LT memories, summary views) -> set status to `idle`
- While resetting, button shows a spinner and status chip shows "Resetting..."

### 3. TranscriptPanel (`transcript-panel.component.tsx`)

Left panel container. Fixed width (55% of viewport on desktop).

Contains:
- `TranscriptFeed` -- the scrollable list of chunks
- `PlaybackControls` -- progress bar and chunk counter at the bottom

### 4. TranscriptFeed (`transcript-feed.component.tsx`)

Scrollable container that renders `TranscriptChunk` components. Auto-scrolls to bottom as new chunks arrive.

**Props:**
- `chunks: TranscriptChunkData[]` -- array of chunks to display (grows during playback)
- `isPlaying: boolean` -- whether new chunks are still arriving

**Behavior:**
- New chunks animate in with a subtle fade-up transition
- Auto-scroll to bottom on new chunk (unless user has scrolled up manually)
- Different visual treatment for RM vs client speakers

### 5. TranscriptChunk (`transcript-chunk.component.tsx`)

A single transcript message bubble. Speaker labels come from `datasetConfig.roles`.

**Props:**
- `timestamp: string` -- "00:12:15"
- `speaker: string` -- "James Morrison"
- `role: string` -- "client" | "rm"
- `roleLabel: string` -- from `config.roles[role].shortLabel` (e.g., "RM", "Client")
- `text: string`
- `isNew: boolean` -- triggers entrance animation

**Visual:**
- Client messages: left-aligned, neutral background
- RM messages: right-aligned, accent background (using `config.branding.accentColor`)
- Timestamp badge above each message
- Speaker name + role label (e.g., "Sarah Chen (RM)")
- Fade-in animation for newly arrived chunks

### 6. PlaybackControls (`playback-controls.component.tsx`)

Progress indicator at the bottom of the transcript panel.

**Props:**
- `currentChunk: number`
- `totalChunks: number`
- `status: PlaybackStatus`

**Visual:**
- MUI LinearProgress bar showing completion percentage
- Text: "12 / 56 chunks" or "Playback complete"

### 7. MemoryExplorerPanel (`memory-explorer-panel.component.tsx`)

Right panel container with a tabbed interface. **Tab labels and descriptions come from `datasetConfig.memoryLabels`.**

**Props:**
- `activeTab: DemoTab`
- `onTabChange: (tab: DemoTab) => void`
- `sessionId: string | null`
- `playbackStatus: PlaybackStatus`
- `datasetConfig: DatasetConfig`

**Tabs (labels from config):**

| Tab | Config Label Source | Icon | When Active |
|---|---|---|---|
| Working Memory | `config.memoryLabels.workingMemory.title` | Memory icon | During and after playback |
| Long-Term Memory | `config.memoryLabels.longTermMemory.title` | Storage icon | After extraction completes |
| Summary Views | `config.memoryLabels.summaryViews.title` | Summarize icon | After creating a summary view |
| Redis Metrics | `config.memoryLabels.metrics.title` | Speed icon | Always |

Each tab shows an empty state with `config.memoryLabels.[tab].description` as the descriptive message when no data is available yet.

### 8. WorkingMemoryTab (`working-memory-tab.component.tsx`)

Displays the current state of working memory for the active session.

**Data source:** `useWorkingMemory(sessionId)` hook, polls `POST /api/getWorkingMemory { sessionId }` every 3 seconds during playback.

**Sections:**

**a) Session Info (top card)** -- uses `config.namespace`, `config.userId`
```
Session: playback-2026-02-26-google-meet-17112...
User: {config.userId}
Namespace: {config.namespace}
Created: 2026-02-26 10:00:00
Last Updated: 2026-02-26 10:14:00
```

**b) Context Window Usage (visual gauge)**
```
Context Window Usage
[====================              ] 32%
4,250 tokens | 68% until summarization
```

- MUI LinearProgress with color coding: green < 50%, yellow 50-80%, red > 80%
- When `context` field is non-null, show a visual flag: "Context summarized"

**c) Working Memory Summary (`working-memory-summary.component.tsx`)**

When the `context` field is populated (agent memory server auto-generates this when the context window fills up), display it in a highlighted card. Section title from `config.memoryLabels.workingMemory.contextSummaryLabel`:

```
{config.memoryLabels.workingMemory.contextSummaryLabel}
┌─────────────────────────────────────────────────┐
│ Sarah and James discussed REIT rebalancing,     │
│ moving $150K into bonds and dividend ETFs.      │
│ James revealed Maya may retire early in 2027... │
└─────────────────────────────────────────────────┘
```

This is a key demo moment -- showing the agent memory server automatically condensing the conversation.

**d) Messages Preview**

Show the last 5 messages with a "Show all (56 messages)" expandable section.

**e) Attached Memories**

If `memories` array in working memory is non-empty, show them as a list of chips.

### 9. LongTermMemoryTab (`long-term-memory-tab.component.tsx`)

Displays long-term memories extracted from the transcript, grouped by memory type.

**Data source:** `useLongTermMemory(sessionId)` hook, fetches from `POST /api/searchLongTermMemoryBySession { sessionId }`.

**Layout:**

Three collapsible sections, each with a count badge. **Section titles and descriptions from `config.memoryLabels.longTermMemory`:**

**a) Semantic Memories -- label: `config.memoryLabels.longTermMemory.semantic.label`**
```
{config.memoryLabels.longTermMemory.semantic.label} (6)
{config.memoryLabels.longTermMemory.semantic.description}
┌─────────────────────────────────────────────┐
│ Maya Morrison considering early retirement   │
│ in 2027                                      │
│ Topics: retirement, spouse, planning         │
│ Entities: Maya Morrison                      │
│ Created: 2026-02-26 10:15                    │
├─────────────────────────────────────────────┤
│ James prefers bond funds over individual     │
│ bond laddering for simplicity                │
│ Topics: investment, preferences, bonds       │
│ Created: 2026-02-26 10:15                    │
└─────────────────────────────────────────────┘
```

**b) Episodic Memories -- label: `config.memoryLabels.longTermMemory.episodic.label`**
```
{config.memoryLabels.longTermMemory.episodic.label} (2)
{config.memoryLabels.longTermMemory.episodic.description}
┌─────────────────────────────────────────────┐
│ REIT rebalance: $150K moved to bonds/ETFs   │
│ Event Date: 2026-02-26                       │
│ Topics: rebalancing, REIT, bonds             │
│ Created: 2026-02-26 10:15                    │
└─────────────────────────────────────────────┘
```

**c) Message Memories -- label: `config.memoryLabels.longTermMemory.message.label`**
```
{config.memoryLabels.longTermMemory.message.label} (0)
No message memories extracted.
```

Each memory is rendered as a `MemoryCard` component.

**MemoryCard features:**
- Color-coded left border by memory type (semantic=blue, episodic=green, message=gray)
- Memory type badge (MUI Chip)
- Topic chips (MUI Chip, outlined)
- Entity chips (MUI Chip, outlined, different color)
- Timestamp
- Expandable full text for long memories

**Refresh button** at the top -- re-fetches long-term memories (useful after extraction completes).

**Search box** (optional V1 enhancement) -- uses `POST /api/searchLongTermMemory { text: "..." }` to filter memories.

### 10. SummaryViewsTab (`summary-views-tab.component.tsx`)

Displays computed summaries. Supports both the **pre-created default view** (for quick demo flow) and **on-the-fly custom views** (for showing flexibility).

**Data source:** `useSummaryViews(defaultSummaryViewId)` hook.

**Workflow (primary demo path -- pre-created view):**

1. The backend pre-creates a default summary view at startup. Its `viewId` is included in the `dataset.get` response as `defaultSummaryViewId`.
2. When the user opens the Summary Views tab, a **"Compute Summary"** button is shown for the default view. No creation step needed.
3. Clicking "Compute Summary" calls `POST /api/computeSummary { viewId: defaultSummaryViewId, group: { user_id: config.userId } }` and shows a loading spinner. This triggers the LLM to generate the narrative (not auto-computed -- must be explicitly triggered).
4. The computed summary is fetched via `POST /api/getComputedSummaries { viewId }` and displayed as a `ComputedSummaryCard`.

**Workflow (optional -- on-the-fly custom views):**

1. **"Create Custom View"** button opens a mini-form (pre-filled from config defaults):
   - Name (text input, default: `config.memoryLabels.summaryViews.defaultViewName`)
   - Source: "Long-Term Memory" or "Working Memory" (radio)
   - Group By: pre-selected from `config.memoryLabels.summaryViews.defaultGroupBy`
2. Calls `POST /api/createSummaryView { name, source, groupBy }`.
3. New view appears in the list with its own "Compute Summary" button.
4. This lets the presenter say: "We can also create custom views grouped by topic, by session, or by time window."

**ComputedSummaryCard display:**

```
SUMMARY: {config.memoryLabels.summaryViews.defaultViewName}
Source: Long-Term Memory | Group: user_id = {config.userId}
Memories analyzed: 8 | Computed: 2026-02-26 10:20

┌─────────────────────────────────────────────────┐
│ James Morrison is a moderate-risk high-net-      │
│ worth client targeting $3M by retirement in      │
│ 2031. He favors dividend income and is           │
│ emotionally conservative during market           │
│ downturns. His daughter Emily starts college     │
│ in 2027 (~$200K needed). Wife Maya may retire    │
│ early 2027, requiring income planning revision.  │
│ Recently rebalanced $150K from REITs into        │
│ bonds and ETFs.                                  │
│                                                  │
│ Condensed from 8 long-term memories.             │
└─────────────────────────────────────────────────┘
```

This is a major demo moment -- showing the agent memory server condensing all extracted memories into a coherent narrative.

**Also supports:**
- List all views via `POST /api/listSummaryViews`
- Fetch computed summaries via `POST /api/getComputedSummaries { viewId }`
- Delete a view via `POST /api/deleteSummaryView { viewId }`

### 11. RedisMetricsTab (`redis-metrics-tab.component.tsx`)

"Redis Under the Hood" -- shows operational stats tracked client-side.

**Data source:** Metrics state tracked in `DemoPage` from API call latencies.

The frontend tracks metrics by measuring each API call:
- Each `POST /append` response includes `latencyMs` -- accumulate these
- Count total API calls by type (working memory writes, reads, LT searches, etc.)

**Layout:**

```
REDIS UNDER THE HOOD

Operations
┌───────────────────────────────────────────┐
│ Transcript chunks processed     56        │
│ Working memory writes           56        │
│ Working memory reads            4         │
│ Long-term memories extracted    8         │
│ Summaries computed              1         │
│ Total API calls                 69        │
└───────────────────────────────────────────┘

Performance
┌───────────────────────────────────────────┐
│ Average latency          42ms             │
│ P95 latency              128ms            │
│ Playback duration        ~2 min           │
└───────────────────────────────────────────┘

Memory Lifecycle
┌───────────────────────────────────────────┐
│ Working Memory  → 56 messages, 4250 tokens│
│ Extraction      → 8 long-term facts       │
│ Summarization   → 1 computed summary      │
│ Forget          → 0 (none applied)        │
└───────────────────────────────────────────┘
```

Each stat is displayed as a key-value row. Values animate/count-up when they change.

### 12. MemoryTypeBadge (`memory-type-badge.component.tsx`)

Reusable colored badge for memory types.

| Type | Color | Label |
|---|---|---|
| `semantic` | Blue (#2196F3) | "Semantic" |
| `episodic` | Green (#4CAF50) | "Episodic" |
| `message` | Gray (#9E9E9E) | "Message" |

Uses MUI Chip with custom colors derived from CSS variables.

---

## Custom Hooks

### `useDatasetConfig()`

Fetches the dataset configuration on mount. This is the **first hook that runs** -- the entire UI depends on it.

```typescript
type UseDatasetConfigResult = {
  config: DatasetConfig | null;
  isLoading: boolean;
  error: string | null;
};
```

**Behavior:**
1. On mount: `POST /api/getDataset {}` (empty body)
2. Unwraps `{ data, error }` response envelope
3. Stores the full config (including `defaultSummaryViewId`) in state
4. While loading, the page shows a centered spinner
5. On error, shows a full-page error with retry button
6. Once loaded, all child components receive `config` as a prop

**DatasetConfig type** (`dataset-config.types.ts`):
```typescript
type RoleConfig = {
  label: string;
  shortLabel: string;
};

type ParticipantConfig = {
  name: string;
  title: string;
  organization: string;
};

type MemoryTypeLabel = {
  label: string;
  description: string;
};

type DatasetConfig = {
  id: string;
  name: string;
  description: string;
  namespace: string;
  userId: string;
  branding: {
    title: string;
    subtitle: string;
    footerText: string;
    accentColor: string;
  };
  roles: Record<string, RoleConfig>;
  participants: Record<string, ParticipantConfig>;
  memoryLabels: {
    workingMemory: {
      title: string;
      description: string;
      contextSummaryLabel: string;
    };
    longTermMemory: {
      title: string;
      description: string;
      semantic: MemoryTypeLabel;
      episodic: MemoryTypeLabel;
      message: MemoryTypeLabel;
    };
    summaryViews: {
      title: string;
      description: string;
      defaultViewName: string;
      defaultGroupBy: string[];
    };
    metrics: {
      title: string;
      description: string;
    };
  };
  transcriptPanel: {
    title: string;
    playingLabel: string;
    completedLabel: string;
  };
  toolbar: {
    transcriptDropdownLabel: string;
    playLabel: string;
    stopLabel: string;
    resetLabel: string;
    speedLabel: string;
  };
  statusLabels: Record<string, string>;
  playbackDefaults: {
    intervalMs: number;
    speeds: Array<{ label: string; intervalMs: number }>;
  };
  defaultSummaryViewId: string;
};
```

Note: `defaultSummaryViewId` is appended by the backend at runtime (not in the static `dataset.config.json` file). The backend pre-creates the summary view at startup and includes its ID in the `dataset.get` response.

### `useTranscriptPlayback(transcriptData, sessionId, intervalMs)`

The core playback hook. The frontend owns the entire playback loop.

```typescript
type UseTranscriptPlaybackResult = {
  displayedChunks: TranscriptChunkData[];
  currentIndex: number;
  totalChunks: number;
  isPlaying: boolean;
  isComplete: boolean;
  lastAppendResult: AppendResult | null;
  metrics: PlaybackMetrics;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
};

type PlaybackMetrics = {
  chunksProcessed: number;
  totalAppendLatencyMs: number;
  avgAppendLatencyMs: number;
  appendLatencies: number[];
};
```

**Behavior:**

1. `start()` begins a `setInterval` at `intervalMs`
2. Each tick:
   a. Get `chunks[currentIndex]` from the pre-loaded transcript
   b. Add it to `displayedChunks` state (UI renders it immediately)
   c. Fire-and-forget `POST /api/appendWorkingMemory { sessionId, chunk, isLastChunk }` with the chunk data
   d. When the POST resolves, update `lastAppendResult` (tokens, context, latency)
   e. Track latency in `metrics`
   f. If `currentIndex === totalChunks - 1`, send with `isLastChunk: true` and stop the interval
3. `stop()` clears the interval but keeps displayed chunks and session intact
4. `reset()` clears everything -- displayed chunks, metrics, session ID

**Why fire-and-forget the POST:** The UI display is instant (from local state). The API call happens in the background. If the API is slow on one tick, the next chunk still displays on time. The `lastAppendResult` state updates asynchronously, so the Working Memory tab shows the latest server-side stats with a slight lag -- which is fine for the demo and actually looks more realistic.

**Why not `await` the POST:** We do not want playback to stall if an API call takes longer than the interval. The visual experience must be smooth regardless of network latency.

### `useWorkingMemory(sessionId, enabled)`

Polls the working memory state at a configurable interval.

```typescript
type UseWorkingMemoryResult = {
  data: WorkingMemoryData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};
```

**Behavior:**
- Polls `POST /api/getWorkingMemory { sessionId }` every `WORKING_MEMORY_POLL_INTERVAL_MS` while `enabled` is true
- Stops polling when playback completes (fetches one final time)
- Provides `refetch` for manual refresh

### `useLongTermMemory(sessionId)`

Fetches long-term memories for a given session.

```typescript
type UseLongTermMemoryResult = {
  memories: MemoryRecordData[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  searchByText: (query: string) => void;
};
```

**Behavior:**
- Fetches from `POST /api/searchLongTermMemoryBySession { sessionId }` on mount and on `refetch`
- `searchByText` hits `POST /api/searchLongTermMemory { text: "..." }`
- Groups memories by `memoryType` for display
- Can poll at `EXTRACTION_POLL_INTERVAL_MS` during the "extracting" phase until memories appear

### `useSummaryViews(defaultSummaryViewId)`

Manages summary views and computed summary operations. The `defaultSummaryViewId` comes from `datasetConfig.defaultSummaryViewId` -- this view is pre-created by the backend at startup.

```typescript
type UseSummaryViewsResult = {
  views: SummaryViewData[];
  summaries: Map<string, ComputedSummaryData[]>;
  isLoading: boolean;
  isComputingSummary: boolean;
  computeDefaultSummary: (group: Record<string, string>) => Promise<void>;
  fetchComputedSummaries: (viewId: string) => Promise<void>;
  createView: (input: CreateSummaryViewInput) => Promise<void>;
  computeSummary: (viewId: string, group: Record<string, string>) => Promise<void>;
  deleteView: (viewId: string) => Promise<void>;
  error: string | null;
};
```

**Behavior:**
- `computeDefaultSummary(group)` -- calls `POST /api/computeSummary { viewId: defaultSummaryViewId, group }`. This is the primary demo action -- one click to trigger LLM summarization.
- `fetchComputedSummaries(viewId)` -- calls `POST /api/getComputedSummaries { viewId }` to read computed summaries.
- `createView(input)` -- calls `POST /api/createSummaryView` for on-the-fly custom views.
- `computeSummaryForView(viewId, group)` -- calls `POST /api/computeSummary` for custom views.
- On mount, fetches the list of views via `POST /api/listSummaryViews`.

### `useBackendHealth()`

Checks backend + agent memory server health on mount and periodically.

```typescript
type UseBackendHealthResult = {
  serverOk: boolean;
  agentMemoryOk: boolean;
  isChecking: boolean;
};
```

---

## API Service (`api.service.ts`)

Centralized fetch wrapper. **All API calls are POST** (except `GET /health`). The backend wraps all responses in `{ data, error }` -- the `apiPost` helper unwraps this automatically.

```typescript
type ApiResponse<T> = { data: T; error: null } | { data: null; error: string };

const apiPost = async <T>(path: string, body: unknown = {}): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json: ApiResponse<T> = await response.json();
  if (json.error) throw new Error(json.error);
  return json.data;
};

const apiGet = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`);
  const json: ApiResponse<T> = await response.json();
  if (json.error) throw new Error(json.error);
  return json.data;
};

// Dataset Config
const fetchDatasetConfig = () =>
  apiPost<DatasetConfig>("/api/getDataset");
const listDatasets = () =>
  apiPost<DatasetListResponse>("/api/listDatasets");

// Transcripts
const fetchTranscripts = () =>
  apiPost<TranscriptListResponse>("/api/listTranscripts");
const fetchTranscript = (transcriptId: string) =>
  apiPost<TranscriptData>("/api/getTranscript", { transcriptId });

// Working Memory
const createWorkingMemory = (transcriptId: string) =>
  apiPost<CreateSessionResponse>("/api/createWorkingMemory", { transcriptId });
const appendChunk = (sessionId: string, chunk: TranscriptChunk, isLastChunk: boolean) =>
  apiPost<AppendResult>("/api/appendWorkingMemory", { sessionId, chunk, isLastChunk });
const fetchWorkingMemory = (sessionId: string) =>
  apiPost<WorkingMemoryData>("/api/getWorkingMemory", { sessionId });
const deleteWorkingMemory = (sessionId: string) =>
  apiPost<void>("/api/deleteWorkingMemory", { sessionId });

// Long-Term Memory
const searchLongTermMemory = (params: LTSearchParams) =>
  apiPost<LTSearchResponse>("/api/searchLongTermMemory", params);
const fetchLTBySession = (sessionId: string) =>
  apiPost<LTSearchResponse>("/api/searchLongTermMemoryBySession", { sessionId });

// Summary Views
const createSummaryView = (input: CreateViewInput) =>
  apiPost<SummaryViewData>("/api/createSummaryView", input);
const listSummaryViews = () =>
  apiPost<SummaryViewListResponse>("/api/listSummaryViews");
const computeSummary = (viewId: string, group: Record<string, string>) =>
  apiPost<ComputedSummaryData>("/api/computeSummary", { viewId, group });
const fetchComputedSummaries = (viewId: string) =>
  apiPost<ComputedSummariesResponse>("/api/getComputedSummaries", { viewId });
const deleteSummaryView = (viewId: string) =>
  apiPost<void>("/api/deleteSummaryView", { viewId });

// Lifecycle
const resetDemo = () =>
  apiPost<ResetResponse>("/api/resetLifecycle");

// Health (GET -- built into cau-api-server)
const fetchHealth = () =>
  apiGet<HealthResponse>("/health");
```

Key differences from a traditional REST API service:
- **All calls are POST** with JSON body params. No URL params, no query strings.
- **`userId` and `namespace` are never sent** -- the backend derives them from the active dataset config.
- **Response envelope** `{ data, error }` is unwrapped by `apiPost` -- hooks receive clean typed data.
- **`createWorkingMemory` and `appendChunk` don't take `userId`** -- backend handles it.

---

## CSS Design System (`variables.css`)

```css
:root {
  /* Colors - Dark theme (event demo appropriate) */
  --bg-primary: #0a0e1a;
  --bg-secondary: #111827;
  --bg-card: #1a2035;
  --bg-card-hover: #1e2844;
  --bg-accent: #1e3a5f;

  --text-primary: #e8eaed;
  --text-secondary: #9aa0a6;
  --text-muted: #6b7280;

  --accent-primary: #dc382c;      /* Redis red (overridden by config.branding.accentColor) */
  --accent-secondary: #ff6b5e;    /* Redis red light (derived from accent-primary) */
  --accent-blue: #2196f3;         /* Semantic memory */
  --accent-green: #4caf50;        /* Episodic memory */
  --accent-gray: #9e9e9e;         /* Message memory */
  --accent-yellow: #ffc107;       /* Warning/attention */

  --border-color: #2d3748;
  --border-radius: 8px;
  --border-radius-sm: 4px;
  --border-radius-lg: 12px;

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;

  /* Typography */
  --font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", monospace;
  --font-size-xs: 11px;
  --font-size-sm: 13px;
  --font-size-base: 15px;
  --font-size-lg: 18px;
  --font-size-xl: 24px;
  --font-size-2xl: 32px;

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5);

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow: 400ms ease;

  /* Layout */
  --toolbar-height: 64px;
  --footer-height: 40px;
  --panel-gap: 16px;
  --transcript-panel-width: 55%;
  --memory-panel-width: 45%;
}
```

### Visual Identity

- **Dark theme** -- appropriate for stage demos, high contrast
- **Redis red** as primary accent -- branding alignment
- **Blue/Green/Gray** for memory type coding -- consistent visual language
- **Monospace font** for timestamps, memory IDs, technical data
- **Card-based layout** -- each memory type in its own card with subtle borders
- **Subtle animations** -- fade-in for new transcript chunks, count-up for metrics

---

## Animations & Transitions

### Transcript Chunk Entrance

```css
@keyframes chunk-enter {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.transcript-chunk--new {
  animation: chunk-enter var(--transition-normal) ease-out;
}
```

### Memory Card Entrance (when extraction completes)

```css
@keyframes card-enter {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.memory-card--new {
  animation: card-enter var(--transition-slow) ease-out;
}
```

### Metric Value Count-Up

When a metric value changes, briefly highlight it:

```css
.metric-value--changed {
  color: var(--accent-secondary);
  transition: color var(--transition-slow);
}
```

---

## State Flow Diagram

```
Page loads
        │
        │  POST /api/getDataset {}
        │  (fetch dataset.config.json -- all labels, namespace,
        │   userId, defaultSummaryViewId)
        ▼
  [CONFIG_LOADING]  (full-page spinner)
        │
        │  Config loaded -- render UI with config-driven labels
        ▼
User selects transcript
        │
        ▼
     [IDLE]
        │
        │  POST /api/getTranscript { transcriptId }
        │  (fetch full transcript JSON)
        ▼
    [LOADING]
        │
        │  POST /api/createWorkingMemory { transcriptId }
        │  (create session, get sessionId)
        ▼
     clicks Play
        │
        ▼
    [PLAYING]
        │
        │  setInterval (client-side)
        │  ┌──────────────────────────────────────────────┐
        │  │ Each tick:                                    │
        │  │  1. Display chunk[i] in UI (instant)          │
        │  │  2. POST /api/appendWorkingMemory           │
        │  │     { sessionId, chunk[i], isLastChunk }      │
        │  │     (fire-and-forget, async)                   │
        │  │  3. Update metrics from { data } response     │
        │  │  4. i++                                       │
        │  └──────────────────────────────────────────────┘
        │
        │  Last chunk: .append { isLastChunk: true }
        │  (triggers background extraction)
        ▼
   [COMPLETED]
        │
        │  Status changes to "Extracting..."
        ▼
  [EXTRACTING]
        │
        │  Poll POST /api/searchLongTermMemory {}
        │  every 5 seconds until memories appear
        ▼
[READY_TO_EXPLORE]
        │
        │  User explores all tabs:
        │  - Working Memory (POST /api/getWorkingMemory)
        │  - Long-Term Memories (POST /api/searchLongTermMemory)
        │  - Summary Views:
        │      POST /api/computeSummary
        │        { viewId: defaultSummaryViewId, group }
        │      POST /api/getComputedSummaries { viewId }
        │  - Redis Metrics (client-side stats)
        │
        │  clicks "{config.toolbar.resetLabel}"
        │  (Clear All Memories & Restart)
        ▼
  [RESETTING]  (confirmation dialog -> spinner)
        │
        │  POST /api/resetLifecycle {}
        │  (wipes all working memory, LT memories, summary views
        │   for the active dataset namespace, re-creates default view)
        │
        │  On success: clear all frontend state
        │  (session, displayed chunks, metrics, memories, summaries)
        ▼
     [IDLE]  (clean slate, ready for another demo run)
```

Note: the "Clear All" button is accessible from **any** state (idle, playing, completed, ready-to-explore). If clicked during playback, it stops the interval first, then proceeds with the reset.

---

## Responsive Considerations

| Viewport | Layout | Notes |
|---|---|---|
| Desktop (>= 1200px) | Side-by-side panels (55/45 split) | Primary demo experience |
| Tablet (768-1199px) | Stacked panels (transcript top, explorer bottom) | Fallback |
| Mobile (< 768px) | Single column with tab switching | Not a priority for stage demo |

The stage demo will run on a large screen (1920x1080 or higher), so desktop is the primary target.

---

## Implementation Priority (Build Order)

| Phase | What | Why |
|---|---|---|
| 1 | `layout.tsx`, `globals.css`, `variables.css`, `app.constants.ts` | Foundation, design system |
| 2 | `api.service.ts` + `dataset-config.types.ts` + all types | API connectivity + config types |
| 3 | `use-dataset-config.ts` + loading/error states in `page.tsx` | Config must load before anything renders |
| 4 | `demo-toolbar.component.tsx` (config-driven labels, transcript dropdown, speed from config, Clear All button, health check) | Top bar with all controls |
| 5 | `transcript-chunk.component.tsx` + `transcript-feed.component.tsx` + `transcript-panel.component.tsx` | Left panel: transcript display (role labels from config) |
| 6 | `use-transcript-playback.ts` (interval from config defaults + POST /append) | Core: playback loop with API calls |
| 7 | `playback-controls.component.tsx` | Progress indicator |
| 8 | `memory-explorer-panel.component.tsx` (tab shell, tab labels from config) | Right panel structure |
| 9 | `working-memory-tab.component.tsx` + `use-working-memory.ts` | Working memory display + polling |
| 10 | `working-memory-summary.component.tsx` (label from config) | Context summary highlight |
| 11 | `long-term-memory-tab.component.tsx` + `memory-card.component.tsx` + `use-long-term-memory.ts` (section labels from config) | Extracted memories display |
| 12 | `summary-views-tab.component.tsx` + `computed-summary-card.component.tsx` + `use-summary-views.ts` (defaults from config)  | Summary views |
| 13 | `redis-metrics-tab.component.tsx` (client-side metrics from API latencies) | Under the hood stats |
| 14 | Polish: animations, empty states, error states, loading states, Clear All confirmation dialog | Demo readiness |

---

## Demo Presenter Script (What to Click)

1. **Open the app** -- dark themed Memory Explorer loads (title from `config.branding.title`), shows config-driven idle status
2. **Select transcript** -- dropdown shows available transcripts for the active dataset
3. **Optionally set speed** -- options from `config.playbackDefaults.speeds`
4. **Click Play** -- transcript chunks start appearing on the left, one at a time, with speaker labels from `config.roles`
5. **Narrate** -- "Each transcript chunk is being written to Redis working memory in real-time. Watch the token count grow."
6. **Click Working Memory tab** -- show session info, growing token count, context window gauge
7. **Wait for context summary** -- "The agent memory server just auto-summarized the conversation to fit the context window"
8. **Playback completes** -- status shows extracting text from `config.statusLabels.extracting`
9. **Memories appear** -- status changes to ready-to-explore
10. **Click Long-Term Memory tab** -- memories appear grouped by type (section labels from `config.memoryLabels.longTermMemory`)
11. **Narrate** -- "These facts were auto-extracted: Maya's retirement, James's bond fund preference, the REIT rebalance decision. Each tagged with topics and entities."
12. **Click Summary Views tab** -- click "Compute Summary" (uses pre-created default view -- no creation step needed), or create a custom view to show flexibility
13. **Narrate** -- "This summary condenses all extracted memories into one coherent narrative. Computed by Redis in under 2 seconds."
14. **Click Redis tab** -- "56 transcript chunks, 8 memories extracted, 1 summary computed. Average latency: 42 milliseconds. All powered by Redis."
15. **Click "Clear All Memories & Restart"** -- confirm dialog, everything resets, clean slate for next demo or next dataset

---

## Key Demo Moments (What Must Look Great)

| Moment | Component | Visual Treatment |
|---|---|---|
| Transcript chunks streaming in | TranscriptFeed | Smooth fade-up animation, auto-scroll |
| Context summary appearing | WorkingMemorySummary | Highlighted card with subtle glow |
| "Extracting..." status | DemoToolbar Chip | Pulsing animation |
| Long-term memories populating | LongTermMemoryTab | Cards animate in one by one |
| Summary generated | ComputedSummaryCard  | Large card, prominent text |
| Metrics dashboard | RedisMetricsTab | Clean grid, numbers count up |

---

## Notes

- **Zero hardcoded display strings.** Every label, title, description, button text, speaker name, and status message is read from `datasetConfig` (fetched once from `POST /api/getDataset`). To support a new dataset, create a new `data/{dataset}/dataset.config.json` and set the backend's `ACTIVE_DATASET` env var. No frontend code changes needed.
- **All backend calls are POST-only** with dot-notation paths. No URL params, no query strings. All parameters in JSON body. Responses unwrapped from `{ data, error }` envelope by `api.service.ts`.
- **`userId` and `namespace` are never sent by the frontend** -- they are derived from the active dataset config on every backend request. The frontend reads them from `datasetConfig` for display purposes only.
- The `config.branding.accentColor` is applied as a CSS custom property override on mount (`document.documentElement.style.setProperty('--accent-primary', config.branding.accentColor)`), allowing per-dataset color theming.
- **Summary views use a pre-created default view.** The backend creates a default summary view at startup; its `viewId` is in `datasetConfig.defaultSummaryViewId`. The frontend can compute a summary with one click -- no view creation step needed. Custom views can also be created on-the-fly for showing flexibility.
- The "Clear All Memories & Restart" button calls `POST /api/resetLifecycle` which wipes all working memory sessions, long-term memories, and summary views within the active namespace. The backend re-creates the default summary view. The frontend then resets its own state. This is essential for live demos where you want a clean slate between runs.
- The frontend follows the project code style: arrow functions, consolidated exports, separate type imports, kebab-case files, PascalCase components, no emojis.
- All components are client components (`"use client"`) since they rely on browser APIs (timers, user interaction).
- MUI is used sparingly -- only for Tabs, Chip, Button, IconButton, LinearProgress, Select, Card, Dialog (for Clear All confirmation). All layout, typography, colors, and animations are pure CSS.
- No state management library needed. React state + hooks are sufficient for this single-page demo. The `datasetConfig` is passed as a prop from `page.tsx` down to all components.
- The `NEXT_PUBLIC_API_BASE_URL` environment variable points to the backend (default `http://localhost:3001`).
- Metrics are tracked entirely client-side by measuring API call latencies. No backend metrics service needed.
- The fire-and-forget pattern in `useTranscriptPlayback` ensures smooth visual playback regardless of API latency. The Working Memory tab may lag 1-2 ticks behind the transcript display -- this is intentional and looks natural.
- Playback speed options come from `config.playbackDefaults.speeds` -- each entry has a `label` (e.g., "2x") and `intervalMs` (e.g., 1000). This means speed options can vary per dataset if needed.
